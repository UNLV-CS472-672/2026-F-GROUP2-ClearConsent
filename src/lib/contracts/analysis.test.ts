import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema } from './analysis';
import { successFixture, InsufficientFixture, FailureFixture, InProgressFixture } from './fixtures';

describe('AnalysisResultSchema Contract & Fixtures', () => {
    // success runs on synthetic fixturesb (4 tests)
    it('validates the success fixture successfully', () => {
        const result = AnalysisResultSchema.safeParse(successFixture);
        expect(result.success).toBe(true);
    });

    it('validates the insufficient fixture successfully', () => {
        const result = AnalysisResultSchema.safeParse(InsufficientFixture);
        expect(result.success).toBe(true);
    });

    it('validates the failure fixture successfully', () => {
        const result = AnalysisResultSchema.safeParse(FailureFixture);
        expect(result.success).toBe(true);
    });

    it('validates the in_progress fixture successfully', () => {
        const result = AnalysisResultSchema.safeParse(InProgressFixture);
        expect(result.success).toBe(true);
    });

    // malformed payload test runs (4 tests)
    it('rejects malformed payloads', () => {
        const malformed = {
            status: 'success',
            analysisId: 'mock_bad_01',
            schemaVersion: 1,
            summary: 'Missing findings array',
            findings: [], // can't be empty 
            takeaways: []
        };

        const result = AnalysisResultSchema.safeParse(malformed);
        expect(result.success).toBe(false);
    });

    it('rejects unknown status types', () => {
        const malformed = {
            status: 'non_existent_status',
            analysisId: 'mock_bad_02',
            schemaVersion: 1
        };

        const result = AnalysisResultSchema.safeParse(malformed);
        expect(result.success).toBe(false);
    });

    it('rejects successful result with missing evidence', () => {
        const malformed = {
            status: 'success',
            analysisId: 'mock_bad_03',
            schemaVersion: 1,
            summary: 'Success finding with missing evidence',
            findings: [
                {
                    id: 'F1',
                    category: 'collection',
                    plain_language_description: 'Location services are automatically collected unless user opts out.',
                    dataCategories: ['Location data', 'IP address'],
                    purposes: ['Service operation'],
                    recipients: [],
                    evidence: [
                        {
                            passageId: 'P1',
                            excerpt: ''
                        }
                    ]
                }
            ]
        };

        const result = AnalysisResultSchema.safeParse(malformed);
        expect(result.success).toBe(false);
    });

    it('rejects failed state with no error code', () => {
        const malformed = {
            status: 'failed',
            analysisId: 'mock_bad_04',
            schemaVersion: 1,
            errorCode: '',
            message: 'Malformed element, no errorCode'
        };
        const result = AnalysisResultSchema.safeParse(malformed);
        expect(result.success).toBe(false);
    });
});