'use client';
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "unstable_catchError", {
    enumerable: true,
    get: function() {
        return unstable_catchError;
    }
});
const _interop_require_wildcard = require("@swc/helpers/_/_interop_require_wildcard");
const _jsxruntime = require("react/jsx-runtime");
const _react = /*#__PURE__*/ _interop_require_wildcard._(require("react"));
const _navigationuntracked = require("./navigation-untracked");
const _isnextroutererror = require("./is-next-router-error");
const _navfailurehandler = require("./nav-failure-handler");
const _handleisrerror = require("./handle-isr-error");
const _isbot = require("../../shared/lib/router/utils/is-bot");
const _approutercontextsharedruntime = require("../../shared/lib/app-router-context.shared-runtime");
const _routercontextsharedruntime = require("../../shared/lib/router-context.shared-runtime");
const isBotUserAgent = typeof window !== 'undefined' && (0, _isbot.isBot)(window.navigator.userAgent);
// This is forked from error-boundary.
// TODO: Extend it instead of forking to easily sync the behavior?
class CatchError extends _react.default.Component {
    static{
        this.contextType = _approutercontextsharedruntime.AppRouterContext;
    }
    static{
        // `unstable_catchError()` is parsed as an HOC-style name and displays as
        // a label (<name> [unstable_catchError]) in DevTools.
        this.displayName = 'unstable_catchError(Next.CatchError)';
    }
    constructor(props){
        super(props), this.reset = ()=>{
            this.setState({
                error: null
            });
        }, this.unstable_retry = ()=>{
            if (this.props.isPagesRouter) {
                throw Object.defineProperty(new Error('`unstable_retry()` can only be used in the App Router. Use `reset()` in the Pages Router.'), "__NEXT_ERROR_CODE", {
                    value: "E1138",
                    enumerable: false,
                    configurable: true
                });
            }
            (0, _react.startTransition)(()=>{
                this.context?.refresh();
                this.reset();
            });
        };
        this.state = {
            error: null,
            previousPathname: this.props.pathname
        };
    }
    static getDerivedStateFromError(error) {
        if ((0, _isnextroutererror.isNextRouterError)(error)) {
            // Re-throw if an expected internal Next.js router error occurs
            // this means it should be handled by a different boundary (such as a NotFound boundary in a parent segment)
            throw error;
        }
        return {
            error
        };
    }
    static getDerivedStateFromProps(props, state) {
        const { error } = state;
        // if we encounter an error while
        // a navigation is pending we shouldn't render
        // the error boundary and instead should fallback
        // to a hard navigation to attempt recovering
        if (process.env.__NEXT_APP_NAV_FAIL_HANDLING) {
            if (error && (0, _navfailurehandler.handleHardNavError)(error)) {
                // clear error so we don't render anything
                return {
                    error: null,
                    previousPathname: props.pathname
                };
            }
        }
        /**
     * Handles reset of the error boundary when a navigation happens.
     * Ensures the error boundary does not stay enabled when navigating to a new page.
     * Approach of setState in render is safe as it checks the previous pathname and then overrides
     * it as outlined in https://react.dev/reference/react/useState#storing-information-from-previous-renders
     */ if (props.pathname !== state.previousPathname && state.error) {
            return {
                error: null,
                previousPathname: props.pathname
            };
        }
        return {
            error: state.error,
            previousPathname: props.pathname
        };
    }
    // Explicit type is needed to avoid the generated `.d.ts` having a wide return type that could be specific to the `@types/react` version.
    render() {
        //When it's bot request, segment level error boundary will keep rendering the children,
        // the final error will be caught by the root error boundary and determine wether need to apply graceful degrade.
        if (this.state.error && !isBotUserAgent) {
            (0, _handleisrerror.handleISRError)({
                error: this.state.error
            });
            return /*#__PURE__*/ (0, _jsxruntime.jsx)(this.props.fallback, {
                props: this.props.props,
                errorInfo: {
                    error: this.state.error,
                    reset: this.reset,
                    unstable_retry: this.unstable_retry
                }
            });
        }
        return this.props.children;
    }
}
function unstable_catchError(fallback) {
    // Create Fallback component from the closure of `unstable_catchError`.
    const Fallback = ({ props, errorInfo })=>fallback(props, errorInfo);
    // Rename to match the user component name for DevTools.
    Fallback.displayName = fallback.name || 'CatchErrorFallback';
    return ({ children, ...props })=>{
        // When we're rendering the missing params shell, this will return null. This
        // is because we won't be rendering any not found boundaries or error
        // boundaries for the missing params shell. When this runs on the client
        // (where these errors can occur), we will get the correct pathname.
        const pathname = (0, _navigationuntracked.useUntrackedPathname)();
        const isPagesRouter = (0, _react.useContext)(_routercontextsharedruntime.RouterContext) !== null;
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(CatchError, {
            pathname: pathname,
            isPagesRouter: isPagesRouter,
            fallback: Fallback,
            props: props,
            children: children
        });
    };
}

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  Object.assign(exports.default, exports);
  module.exports = exports.default;
}

//# sourceMappingURL=catch-error.js.map