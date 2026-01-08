// This file provides type definitions for the Deno namespace
// to prevent "Cannot find name 'Deno'" errors in editors without the Deno extension.

declare global {
    var Deno: {
        serve(handler: (req: Request) => Response | Promise<Response>): void;
        env: {
            get(key: string): string | undefined;
        };
        [key: string]: any;
    };
}

export { };
