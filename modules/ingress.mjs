import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import Ajv from "https://esm.sh/ajv";
import {
    withLatestFrom,
    map,
    zip,
    pipe,
    switchMap,
    combineLatest,
    merge,
    of,
} from "rxjs";

export const role = "ingress";
export const key = "default-ingress";
export const version = "0.0.1";

const DefaultIngress = (operable) => {
    return operable.io.upstream$.pipe(
        switchMap((upstreams) => {
            return merge(...upstreams.map(({ read: { output$ } }) => output$));
        })
    );
};

export default DefaultIngress;
