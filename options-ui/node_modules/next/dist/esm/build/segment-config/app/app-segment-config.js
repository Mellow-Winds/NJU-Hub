import { z } from 'next/dist/compiled/zod';
import { formatZodError } from '../../../shared/lib/zod';
const CookieSchema = z.object({
    name: z.string(),
    value: z.string().or(z.null())
}).strict();
const RuntimeSampleSchema = z.object({
    cookies: z.array(CookieSchema).optional(),
    headers: z.array(z.tuple([
        z.string(),
        z.string().or(z.null())
    ])).optional(),
    params: z.record(z.union([
        z.string(),
        z.array(z.string())
    ])).optional(),
    searchParams: z.record(z.union([
        z.string(),
        z.array(z.string()),
        z.null()
    ])).optional()
}).strict();
const InstantConfigStaticSchema = z.object({
    prefetch: z.literal('static'),
    samples: z.array(RuntimeSampleSchema).min(1).optional(),
    from: z.array(z.string()).optional(),
    unstable_disableValidation: z.literal(true).optional(),
    unstable_disableDevValidation: z.literal(true).optional(),
    unstable_disableBuildValidation: z.literal(true).optional()
}).strict();
const InstantConfigRuntimeSchema = z.object({
    prefetch: z.literal('runtime'),
    samples: z.array(RuntimeSampleSchema).min(1),
    from: z.array(z.string()).optional(),
    unstable_disableValidation: z.literal(true).optional(),
    unstable_disableDevValidation: z.literal(true).optional(),
    unstable_disableBuildValidation: z.literal(true).optional()
}).strict();
const InstantConfigSchema = z.union([
    z.discriminatedUnion('prefetch', [
        InstantConfigStaticSchema,
        InstantConfigRuntimeSchema
    ]),
    z.literal(false)
]);
/**
 * The schema for configuration for a page.
 */ const AppSegmentConfigSchema = z.object({
    /**
   * The number of seconds to revalidate the page or false to disable revalidation.
   */ revalidate: z.union([
        z.number().int().nonnegative(),
        z.literal(false)
    ]).optional(),
    /**
   * Whether the page supports dynamic parameters.
   */ dynamicParams: z.boolean().optional(),
    /**
   * The dynamic behavior of the page.
   */ dynamic: z.enum([
        'auto',
        'error',
        'force-static',
        'force-dynamic'
    ]).optional(),
    /**
   * The caching behavior of the page.
   */ fetchCache: z.enum([
        'auto',
        'default-cache',
        'only-cache',
        'force-cache',
        'force-no-store',
        'default-no-store',
        'only-no-store'
    ]).optional(),
    /**
   * How this segment should be prefetched.
   */ unstable_instant: InstantConfigSchema.optional(),
    /**
   * The stale time for dynamic responses in seconds.
   * Controls how long the client-side router cache retains dynamic page data.
   * Pages only — not allowed in layouts.
   */ unstable_dynamicStaleTime: z.number().int().nonnegative().optional(),
    /**
   * The preferred region for the page.
   */ preferredRegion: z.union([
        z.string(),
        z.array(z.string())
    ]).optional(),
    /**
   * The runtime to use for the page.
   */ runtime: z.enum([
        'edge',
        'nodejs'
    ]).optional(),
    /**
   * The maximum duration for the page in seconds.
   */ maxDuration: z.number().int().nonnegative().optional()
});
/**
 * Parse the app segment config.
 * @param data - The data to parse.
 * @param route - The route of the app.
 * @returns The parsed app segment config.
 */ export function parseAppSegmentConfig(data, route) {
    const parsed = AppSegmentConfigSchema.safeParse(data, {
        errorMap: (issue, ctx)=>{
            if (issue.path.length === 1) {
                switch(issue.path[0]){
                    case 'revalidate':
                        {
                            return {
                                message: `Invalid revalidate value ${JSON.stringify(ctx.data)} on "${route}", must be a non-negative number or false`
                            };
                        }
                    case 'unstable_instant':
                        {
                            return {
                                // @TODO replace this link with a link to the docs when they are written
                                message: `Invalid unstable_instant value ${JSON.stringify(ctx.data)} on "${route}", must be an object with \`prefetch: "static"\` or \`prefetch: "runtime"\`, or \`false\`. Read more at https://nextjs.org/docs/messages/invalid-instant-configuration`
                            };
                        }
                    case 'unstable_dynamicStaleTime':
                        {
                            return {
                                message: `Invalid unstable_dynamicStaleTime value ${JSON.stringify(ctx.data)} on "${route}", must be a non-negative number`
                            };
                        }
                    default:
                }
            }
            return {
                message: ctx.defaultError
            };
        }
    });
    if (!parsed.success) {
        throw formatZodError(`Invalid segment configuration options detected for "${route}". Read more at https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config`, parsed.error);
    }
    return parsed.data;
}
/**
 * The keys of the configuration for a page.
 *
 * @internal - required to exclude zod types from the build
 */ export const AppSegmentConfigSchemaKeys = AppSegmentConfigSchema.keyof().options;

//# sourceMappingURL=app-segment-config.js.map