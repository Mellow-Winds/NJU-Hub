"""
train.py — 训练南大验证码专用识别模型

模型架构: 小型 CNN + BiLSTM + CTC loss
输入: 1x64x192 灰度图（固定宽度，padding 到 192）
输出: CTC 编码的字符序列

用法:
    python train.py --samples ./samples --labels labels.json --epochs 100 --batch_size 32
"""

import os
import json
import argparse
import random
import numpy as np
from PIL import Image, ImageFilter
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYabcdefghijkmnpqrstuvwxy"
NUM_CLASSES = len(CHARSET) + 1  # +1 for CTC blank (index 0)
CHAR_TO_IDX = {ch: i + 1 for i, ch in enumerate(CHARSET)}  # 1..54
IDX_TO_CHAR = {i + 1: ch for i, ch in enumerate(CHARSET)}
IDX_TO_CHAR[0] = ""  # blank

TARGET_HEIGHT = 64
TARGET_WIDTH = 192  # 固定宽度，避免 input_lengths 计算错误


class CaptchaDataset(Dataset):
    def __init__(self, samples_dir, labels_file, augment=False):
        self.samples_dir = samples_dir
        with open(labels_file, "r", encoding="utf-8") as f:
            self.labels = json.load(f)
        self.files = list(self.labels.keys())
        self.augment = augment

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        filename = self.files[idx]
        filepath = os.path.join(self.samples_dir, filename)

        img = Image.open(filepath).convert("L")
        # 固定尺寸: 64x192
        img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.BILINEAR)

        if self.augment:
            # 旋转
            angle = random.uniform(-5, 5)
            img = img.rotate(angle, fillcolor=255, expand=False)
            # 高斯模糊
            if random.random() < 0.3:
                img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8)))
            # 亮度
            if random.random() < 0.3:
                arr = np.array(img, dtype=np.float32)
                factor = random.uniform(0.75, 1.25)
                arr = np.clip(arr * factor, 0, 255)
                img = Image.fromarray(arr.astype(np.uint8), mode="L")
            # 高斯噪声
            if random.random() < 0.3:
                arr = np.array(img, dtype=np.float32)
                noise = np.random.normal(0, random.uniform(3, 15), arr.shape)
                arr = np.clip(arr + noise, 0, 255)
                img = Image.fromarray(arr.astype(np.uint8), mode="L")
            # 随机遮挡小块
            if random.random() < 0.1:
                arr = np.array(img, dtype=np.uint8)
                x0 = random.randint(0, arr.shape[1] - 10)
                y0 = random.randint(0, arr.shape[0] - 6)
                arr[y0:y0+6, x0:x0+10] = 255
                img = Image.fromarray(arr, mode="L")

        arr = np.array(img, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(arr).unsqueeze(0)  # [1, H, W]

        label_str = self.labels[filename]
        label_idx = [CHAR_TO_IDX[c] for c in label_str if c in CHAR_TO_IDX]
        return tensor, torch.tensor(label_idx, dtype=torch.long)


class CaptchaCNN(nn.Module):
    """精简模型: 3层CNN + 1层BiLSTM，大幅减少参数量"""
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2, 2),   # 64→32
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2, 2),  # 32→16
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d((2, 1), (2, 1)), # 16→8 (h方向), w不变
            nn.Conv2d(128, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d((2, 1), (2, 1)), # 8→4 (h方向), w不变
        )
        # 经过4次MaxPool: h=64→32→16→8→4, w=192→96→48→48→48
        # LSTM input: 128 * 4 = 512, seq_len = 48
        self.rnn = nn.LSTM(128 * 4, 128, num_layers=1, bidirectional=True, batch_first=True, dropout=0.0)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(256, num_classes)

    def forward(self, x):
        features = self.cnn(x)
        b, c, h, w = features.shape
        features = features.permute(0, 3, 1, 2).reshape(b, w, c * h)
        rnn_out, _ = self.rnn(features)
        rnn_out = self.dropout(rnn_out)
        output = self.fc(rnn_out)
        return output.permute(1, 0, 2)  # [seq_len, batch, num_classes]


def collate_fn(batch):
    images, labels = zip(*batch)
    # 固定尺寸，不需要 padding
    images = torch.stack(images)
    # 所有图片都是 64x192，经过 CNN 后 seq_len = 48
    input_lengths = torch.full((len(batch),), 48, dtype=torch.long)
    label_lengths = torch.tensor([len(l) for l in labels], dtype=torch.long)
    concat_labels = torch.cat(labels)
    return images, concat_labels, input_lengths, label_lengths


def ctc_greedy_decode(pred, idx):
    argmax = pred.argmax(dim=2)
    decoded = []
    prev = 0
    for t in range(argmax.size(0)):
        c = argmax[t, idx].item()
        if c != 0 and c != prev:
            decoded.append(c)
        prev = c
    return "".join([IDX_TO_CHAR.get(c, "?") for c in decoded])


def train(samples_dir, labels_file, epochs, output_path, lr=1e-3, batch_size=32):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"设备: {device}")
    print(f"字符集 ({len(CHARSET)}): {CHARSET}")
    print(f"类别数: {NUM_CLASSES} (含blank)")

    with open(labels_file, "r", encoding="utf-8") as f:
        all_labels = json.load(f)
    all_files = list(all_labels.keys())
    random.seed(42)
    random.shuffle(all_files)
    split = int(len(all_files) * 0.9)
    train_labels = {k: all_labels[k] for k in all_files[:split]}
    val_labels = {k: all_labels[k] for k in all_files[split:]}

    train_labels_file = labels_file + ".train"
    val_labels_file = labels_file + ".val"
    with open(train_labels_file, "w", encoding="utf-8") as f:
        json.dump(train_labels, f, ensure_ascii=False)
    with open(val_labels_file, "w", encoding="utf-8") as f:
        json.dump(val_labels, f, ensure_ascii=False)

    train_set = CaptchaDataset(samples_dir, train_labels_file, augment=True)
    val_set = CaptchaDataset(samples_dir, val_labels_file, augment=False)
    print(f"训练集: {len(train_set)} 张, 验证集: {len(val_set)} 张")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, collate_fn=collate_fn, drop_last=True)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, collate_fn=collate_fn)

    model = CaptchaCNN().to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"模型参数量: {total_params:,}")

    ctc_loss = nn.CTCLoss(blank=0, zero_infinity=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=5e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5, min_lr=1e-6)

    print(f"\n开始训练 ({epochs} epochs, batch_size={batch_size})...")

    best_acc = 0
    patience = 20
    no_improve = 0

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        correct = 0
        total = 0

        for images, labels, input_lens, label_lens in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            input_lens = input_lens.to(device)
            label_lens = label_lens.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            log_probs = F.log_softmax(outputs, dim=2)
            loss = ctc_loss(log_probs, labels, input_lens, label_lens)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()

            total_loss += loss.item()
            for i in range(images.size(0)):
                pred_str = ctc_greedy_decode(log_probs, i)
                start = sum(label_lens[:i])
                end = start + label_lens[i]
                true_str = "".join([IDX_TO_CHAR.get(c.item(), "?") for c in labels[start:end]])
                if pred_str == true_str:
                    correct += 1
                total += 1

        train_loss = total_loss / len(train_loader)
        train_acc = correct / max(total, 1) * 100

        model.eval()
        val_correct = 0
        val_total = 0
        val_loss = 0

        with torch.no_grad():
            for images, labels, input_lens, label_lens in val_loader:
                images = images.to(device)
                labels = labels.to(device)
                input_lens = input_lens.to(device)
                label_lens = label_lens.to(device)
                outputs = model(images)
                log_probs = F.log_softmax(outputs, dim=2)
                val_loss += ctc_loss(log_probs, labels, input_lens, label_lens).item()
                for i in range(images.size(0)):
                    pred_str = ctc_greedy_decode(log_probs, i)
                    start = sum(label_lens[:i])
                    end = start + label_lens[i]
                    true_str = "".join([IDX_TO_CHAR.get(c.item(), "?") for c in labels[start:end]])
                    if pred_str == true_str:
                        val_correct += 1
                    val_total += 1

        val_acc = val_correct / max(val_total, 1) * 100
        val_loss_avg = val_loss / max(len(val_loader), 1)

        scheduler.step(val_loss_avg)

        print(f"  Epoch {epoch+1:3d}/{epochs}: train_loss={train_loss:.4f} train_acc={train_acc:.1f}% | val_loss={val_loss_avg:.4f} val_acc={val_acc:.1f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save({"model": model.state_dict(), "epoch": epoch + 1, "val_acc": val_acc, "charset": CHARSET}, "best_model.pt")
            print(f"    ★ 新最佳模型! val_acc={val_acc:.1f}%, 已保存 best_model.pt")
            no_improve = 0
        else:
            no_improve += 1
            if no_improve >= patience:
                print(f"  早停: {patience} 轮无提升")
                break

    torch.save({"model": model.state_dict(), "epoch": epochs, "charset": CHARSET}, "final_model.pt")
    print(f"\n训练完成! 最佳验证准确率: {best_acc:.1f}%")
    print(f"  best_model.pt (最佳模型)")
    print(f"  final_model.pt (最终模型)")
    print(f"\n运行: python export_onnx.py --checkpoint best_model.pt --output captcha_custom.onnx")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="训练南大验证码识别模型")
    parser.add_argument("--samples", type=str, default="./samples", help="样本目录")
    parser.add_argument("--labels", type=str, default="labels.json", help="标注文件")
    parser.add_argument("--epochs", type=int, default=100, help="训练轮数")
    parser.add_argument("--output", type=str, default="captcha_custom.onnx", help="输出模型路径")
    parser.add_argument("--lr", type=float, default=1e-3, help="学习率")
    parser.add_argument("--batch_size", type=int, default=32, help="批大小")
    args = parser.parse_args()
    
    train(args.samples, args.labels, args.epochs, args.output, args.lr, args.batch_size)
