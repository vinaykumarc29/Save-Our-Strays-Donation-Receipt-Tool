import crypto from 'crypto';

class JobManager {
    constructor() {
        this.jobs = new Map();
        // Periodically cleanup completed/failed jobs older than 1 hour
        this.cleanupInterval = setInterval(() => this.cleanupOldJobs(), 10 * 60 * 1000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref(); // Do not keep event loop active on exit
        }
    }

    createJob(total) {
        const jobId = crypto.randomUUID();
        const job = {
            jobId,
            status: 'PENDING',
            total: Number(total) || 0,
            processed: 0,
            successful: 0,
            failed: 0,
            results: [],
            error: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: null
        };
        this.jobs.set(jobId, job);
        this.enforceMaxCapacity(100);
        return job;
    }

    getJob(jobId) {
        if (!jobId) return null;
        return this.jobs.get(jobId) || null;
    }

    updateJob(jobId, updates) {
        const job = this.jobs.get(jobId);
        if (!job) return null;
        Object.assign(job, updates, { updatedAt: Date.now() });
        return job;
    }

    cleanupOldJobs(maxAgeMs = 60 * 60 * 1000) {
        const now = Date.now();
        for (const [id, job] of this.jobs.entries()) {
            if (['COMPLETED', 'FAILED'].includes(job.status)) {
                if (now - (job.completedAt || job.updatedAt) > maxAgeMs) {
                    this.jobs.delete(id);
                }
            }
        }
    }

    enforceMaxCapacity(maxJobs = 100) {
        if (this.jobs.size > maxJobs) {
            // Delete oldest completed or failed jobs first
            const entries = Array.from(this.jobs.entries());
            for (const [id, job] of entries) {
                if (this.jobs.size <= maxJobs) break;
                if (['COMPLETED', 'FAILED'].includes(job.status)) {
                    this.jobs.delete(id);
                }
            }
        }
    }

    clearAllJobs() {
        this.jobs.clear();
    }
}

export const jobManager = new JobManager();
