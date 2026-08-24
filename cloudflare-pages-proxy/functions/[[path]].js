export async function onRequest({ request, env }) {
  return env.PONEVEZ_APP.fetch(request);
}
