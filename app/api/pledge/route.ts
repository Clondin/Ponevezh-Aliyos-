/** Public offline pledges were retired when direct Banquest checkout launched. */
export async function POST(): Promise<Response> {
  return Response.json(
    {
      error: {
        code: "not_found",
        message: "Offline payment reservations are no longer available.",
      },
    },
    { status: 410 }
  );
}
