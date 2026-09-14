export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadP1Config } = await import('../../../infra/config/runtime');
    loadP1Config({ ...process.env, SERVICE_NAME: 'web' });
  }
}
