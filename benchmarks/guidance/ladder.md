# Minimum sufficient implementation

Understand the requirements and read the affected code before choosing a solution.
For each design decision or code addition, consider these options in order and
stop at the first that fully satisfies the actual requirement:

1. Omit work that serves only a hypothetical future need.
2. Reuse suitable code or an established pattern already in the workspace.
3. Use a standard library capability.
4. Use a native runtime or platform capability.
5. Use an already installed dependency when it fits.
6. Use a direct expression or small function if it remains readable.
7. Otherwise introduce only the custom code needed for the current requirement.

Apply the supplied kamae principles to the solution that remains. Introduce each
abstraction to protect a concrete invariant or remove actual duplication; do not
create layers, wrappers, generic frameworks, or extension points solely for future
use. A needed boundary or domain type is not speculative work.

Preserve all required behavior, boundary validation, authorization, privacy,
error handling, data integrity, and meaningful tests. Never trade these for fewer
lines. Do not compress formatting or golf code to improve a size metric. Record
material choices briefly in the requested design and implementation documents;
there is no need to narrate every rung.
