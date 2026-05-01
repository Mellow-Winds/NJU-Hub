import { parseReqUrl } from '../../../lib/url';
import { formatUrl } from '../../../shared/lib/router/utils/format-url';
export function normalizeAppPageRequestUrl(req, pathname) {
    if (!req.url) {
        return;
    }
    const normalizedUrl = parseReqUrl(req.url);
    if (!normalizedUrl) {
        return;
    }
    normalizedUrl.pathname = pathname;
    req.url = formatUrl(normalizedUrl);
}

//# sourceMappingURL=normalize-request-url.js.map