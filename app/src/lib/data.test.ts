import { describe, expect, it } from 'vitest';
import { defaultVariation, type ShockMeta } from './data';

const shock = (available: string[]): ShockMeta => ({ name: 'X', labelDa: 'X', labelEn: 'X', group: 'G', available });

describe('defaultVariation', () => {
	it('opens a permanent shock unfinanced, whatever order meta lists the variants in', () => {
		expect(defaultVariation(shock(['_perm', '_ufin']))).toBe('_ufin');
		expect(defaultVariation(shock(['_blip', '_midl', '_perm', '_ufin']))).toBe('_ufin');
	});

	it('falls back to financed, then the temporary profiles', () => {
		expect(defaultVariation(shock(['_perm']))).toBe('_perm');
		expect(defaultVariation(shock(['_blip', '_midl']))).toBe('_midl');
	});

	it('has no default for a shock that is not solved yet', () => {
		expect(defaultVariation(shock([]))).toBeUndefined();
	});
});
