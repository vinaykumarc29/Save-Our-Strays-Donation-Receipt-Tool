/**
 * Utility for classifying errors as transient (retryable) or permanent (non-retryable).
 */

export function isRetryableError(error) {
    if (!error) return false;

    const msg = String(error.message || '');

    // 1. Validation errors from validateRowData.js are permanent - NEVER retry
    if (msg.startsWith('Error processing Row')) {
        return false;
    }

    // 2. PDF rendering errors are permanent data/template issues - NEVER retry
    if (msg.startsWith('PDF generation error')) {
        return false;
    }

    // 3. SMTP permanent rejection codes (5xx) - NEVER retry
    // e.g. 550 User unknown, 553 Relaying denied, 501 Syntax error, 535 Auth failed
    const responseCode = Number(error.responseCode);
    if (!isNaN(responseCode)) {
        if (responseCode >= 500) {
            return false;
        }
        if (responseCode >= 400 && responseCode < 500) {
            // 4xx: Transient SMTP errors (421 Service not available, 450 Mailbox busy, 451 Local error)
            return true;
        }
    }

    // 4. Known transient Node.js / network socket error codes
    const transientCodes = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'ESOCKET',
        'EAI_AGAIN',
        'ENOTFOUND',
        'EPIPE',
        'EBUSY'
    ];
    if (error.code && transientCodes.includes(error.code)) {
        return true;
    }

    // 5. Common transient error message patterns
    const lower = msg.toLowerCase();
    if (
        lower.includes('timeout') ||
        lower.includes('timed out') ||
        lower.includes('connection reset') ||
        lower.includes('connection closed') ||
        lower.includes('greeting never received') ||
        lower.includes('socket closed') ||
        lower.includes('econnreset') ||
        lower.includes('etimedout') ||
        lower.includes('network error') ||
        lower.includes('temporary')
    ) {
        return true;
    }

    // Default to false for unclassified exceptions to avoid uncontrolled retry loops
    return false;
}

