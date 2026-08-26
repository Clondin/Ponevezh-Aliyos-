/** The Admire reservation flow has been retired in favor of direct Banquest checkout. */
export async function POST(): Promise<Response> {
  return Response.json(
    {
      error: {
        code: "gone",
        message: "This payment option is no longer available.",
      },
    },
    { status: 410 }
  );
}
