// webportal/data.js — NJU-Hub 网址导航数据
// 三级树形结构：一级分类 → 二级分类 → 卡片链接

const PORTAL_DATA = [
  {
    id: "official",
    name: "南京大学官方网站",
    subs: [
      {
        id: "portal",
        name: "校务与门户",
        links: [
          { id: "nju-home", name: "南京大学官方网站", desc: "南京大学官方网站", url: "https://www.nju.edu.cn/" },
          { id: "nju-mail", name: "南京大学邮件系统", desc: "南京大学邮件系统，用于收发邮件", url: "https://mail.nju.edu.cn/" },
          { id: "ehall", name: "网上办事服务大厅", desc: "校内各种行政审批、杂务办理统一入口。查看课表、培养方案、成绩，评教等都在这里。", url: "https://ehall.nju.edu.cn/" },
          { id: "itsc", name: "信息化建设管理服务中心", desc: "正版软件、与信息化有关的教程都可以在这里找到。", url: "https://itsc.nju.edu.cn/" },
          { id: "p-nju", name: "上网服务", desc: "校园网登录的认证和管理页面", url: "https://p.nju.edu.cn" },
          { id: "nju-box", name: "南大云盘：NJU Box", desc: "南大云盘，有很多实用的功能", url: "https://box.nju.edu.cn/" }
        ]
      },
      {
        id: "edu",
        name: "教务与选课",
        links: [
          { id: "jwc", name: "本科生院", desc: "查看教学公告、学籍管理规定与考试安排等", url: "https://jw.nju.edu.cn" },
          { id: "xk", name: "选课系统", desc: "每学期抢课、退补选课平台", url: "https://xk.nju.edu.cn/" },
          { id: "elite", name: "交换生平台", desc: "GPA排名查询和交换项目申请", url: "http://elite.nju.edu.cn/exchangesystem/" }
        ]
      },
      {
        id: "course",
        name: "课程与修读",
        links: [
          { id: "lms", name: "智汇南雍 LMS 平台", desc: "部分课程的签到、作业提交、下载课件会使用此平台", url: "https://lms.nju.edu.cn" },
          { id: "spoc", name: "阅读 SPOC 官方网站", desc: "悦读课的专属 SPOC 学习平台", url: "https://study.nju.edu.cn" },
          { id: "labor", name: "劳育平台", desc: "南京大学劳动教育平台。", url: "https://ndwy.nju.edu.cn" },
          { id: "ggty", name: "体育成绩管理平台", desc: "在这里可以看到自己的体育课成绩、体测成绩", url: "https://ggtypt.nju.edu.cn/ggtypt/home" },
          { id: "youth", name: "志愿平台", desc: "志愿服务平台", url: "https://youth.nju.edu.cn/" }
        ]
      },
      {
        id: "sub-dept",
        name: "子部门网站",
        links: [
          { id: "cselab", name: "计算机科学技术与软件工程实验教学中心", desc: "", url: "https://cselab.nju.edu.cn/main.psp" },
          { id: "tyb", name: "体育部", desc: "查看体测成绩、阳光体育打卡规则与选课", url: "https://tyb.nju.edu.cn/" },
          { id: "hospital", name: "校医院", desc: "提供医疗服务与健康咨询", url: "https://hospital.nju.edu.cn/" },
        ]
      }
    ]
  },
  {
    id: "resource",
    name: "资源",
    subs: [
      {
        id: "official-res",
        name: "学校官方资源",
        links: [
          { id: "escience", name: "e-Science 中心", desc: "e-Science中心", url: "https://sci.nju.edu.cn/" },
          { id: "nju-box-res", name: "南大云盘 NJU Box", desc: "南大云盘，有很多实用的功能", url: "https://box.nju.edu.cn/" },
          { id: "mirrors", name: "南京大学镜像站", desc: "开源软件镜像高速下载", url: "https://mirrors.nju.edu.cn/" }
        ]
      },
      {
        id: "unofficial",
        name: "非官方资料整理",
        links: [
          { id: "gulini", name: "鼓励你学哪门课榜", desc: "红黑榜的一个网站", url: "https://table.nju.edu.cn/apps/custom/ad-astra/?page_id=AeyG" },
          {id:"red-black-table",name:"红黑榜（25年及以前）",desc:"25年及以前的红黑榜原始数据",url:"https://table.nju.edu.cn/external-apps/7aded834-74a2-43cc-b515-fb8e01656ef2/?page_id=zI1D"},
          {id:"red-black-table-search1",name:"红黑榜搜索平台：其一",desc:"这个网站可以搜索红黑榜的数据。",url:"https://xk.nju.at/"},
          { id: "nanna-helper", name: "南哪助手教学资料库", desc: "如题", url: "https://table.nju.edu.cn/apps/custom/nannadata/?page_id=kw9T" },
          {id:"yuque-newer",name:"语雀新生手册",desc:"由南哪助手整理的语雀文档，主要讲解的是一些常见的问题",url:"https://www.yuque.com/greatnju/q-a2.0"},
          {id:"nanruanfojiao",name:"南软佛脚玩乐指南",desc:"一位软院学长的资料库。有很多实用的内容:)",url:"https://costg.gitbook.io/njuse"},
        ]
      }
    ]
  },
  {
    id: "study",
    name: "学习",
    subs: [
      {
        id: "platform",
        name: "学习平台",
        links: [
          { id: "lms", name: "南京大学智汇南雍：LMS平台", desc: "部分课程会使用此平台", url: "https://lms.nju.edu.cn" },
          { id: "spoc", name: "阅读 SPOC 官方网站", desc: "悦读课的专属学习平台", url: "https://study.nju.edu.cn" },
          { id: "icourse", name: "中国大学MOOC", desc: "MOOC网站，部分通识课、劳育课在这里开展。", url: "https://www.icourse163.org/" },
          {id:"zhihuishu", name:"智慧树教学平台",desc: "新生的数学零年级课程似乎是在这个平台开展。", url:"https://onlineweb.zhihuishu.com/"},
          {id:"ketangpai", name:"课堂派",desc:"部分课程会在这个平台开展。比如zc老师的vjf。",url:"https://www.ketangpai.com/"},
          {id:"chaoxing",name:"学习通",desc:"学习通，部分课程会在这个平台开展。",url:"https://i.chaoxing.com"},
          {id:"WE Learn",name:"WE Learn学习平台",desc:"部分英语听说课的教学在这个平台开展。",url:"https://welearn.sflep.com/"},
        ]
      },
      {
        id: "official-other",
        name: "其他常用网站",
        links: [
          {id:"zhiwang",name:"中国知网",desc:"知网。",url:"https://www.cnki.net/"},
          {id:"xuexinwang",name:"学信网",desc:"在此处可以查看学籍信息等",url:"https://www.chsi.com.cn/"}
        ]
      },
      {
        id: "other",
        name: "其他不好分类的东西",
        links: [
          {id:"daguodexingshuai",name:"南京大学“悦读”《大国的兴衰》作业答案",desc:"说实话，这能找到确实让我感到惊讶",url:"https://www.doc88.com/p-7488996916443.html?r=1"}
        ]
      }
    ]
  }
];