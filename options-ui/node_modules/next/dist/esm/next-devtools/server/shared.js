import { codeFrameColumns } from '../../shared/lib/errors/code-frame';
import { ignoreListAnonymousStackFramesIfSandwiched as ignoreListAnonymousStackFramesIfSandwichedGeneric } from '../../server/lib/source-maps';
export function ignoreListAnonymousStackFramesIfSandwiched(responses) {
    ignoreListAnonymousStackFramesIfSandwichedGeneric(responses, (response)=>{
        return response.status === 'fulfilled' && response.value.originalStackFrame !== null && response.value.originalStackFrame.file === '<anonymous>';
    }, (response)=>{
        return response.status === 'fulfilled' && response.value.originalStackFrame !== null && response.value.originalStackFrame.ignored === true;
    }, (response)=>{
        return response.status === 'fulfilled' && response.value.originalStackFrame !== null ? response.value.originalStackFrame.methodName : '';
    }, (response)=>{
        ;
        response.value.originalStackFrame.ignored = true;
    });
}
/**
 * It looks up the code frame of the traced source.
 * @note It ignores Next.js/React internals, as these can often be huge bundled files.
 */ export function getOriginalCodeFrame(frame, source, colors = process.stdout.isTTY) {
    if (!source || frame.line1 == null) {
        return null;
    }
    return codeFrameColumns(source, {
        start: {
            line: frame.line1,
            column: frame.column1 ?? undefined
        }
    }, {
        color: colors
    }) ?? null;
}

//# sourceMappingURL=shared.js.map