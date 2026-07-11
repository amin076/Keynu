export class JobValidationService {
  validate(kap: any): { ok: boolean; error?: string } {
    if (!kap?.payload?.target) {
      return { ok: false, error: 'Missing target' };
    }

    if (kap.payload.target === 'filesystem') {
      const action = kap.payload.request?.action;
      const allowed = ['writeFile', 'readFile', 'listDirectory'];

      if (!allowed.includes(action)) {
        return {
          ok: false,
          error: `Unsupported filesystem action: ${action}`,
        };
      }
    }

    return { ok: true };
  }
}
