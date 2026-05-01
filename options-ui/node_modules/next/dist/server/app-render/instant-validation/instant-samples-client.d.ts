import type { Params } from '../../request/params';
import type { ReadonlyURLSearchParams } from '../../../client/components/readonly-url-search-params';
export declare function instrumentParamsForClientValidation<TPArams extends Params>(underlyingParams: TPArams): TPArams;
export declare function expectCompleteParamsInClientValidation(expression: string): void;
export declare function instrumentSearchParamsForClientValidation(underlyingSearchParams: ReadonlyURLSearchParams): ReadonlyURLSearchParams;
