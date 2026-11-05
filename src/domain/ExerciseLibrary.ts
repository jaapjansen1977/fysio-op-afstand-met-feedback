import { z } from 'zod';
import library from '../data/exercises.json';

export const metricKeys = ['maxKneeFlexion', 'kneeROM', 'maxHipFlexion', 'maxTrunkInclination', 'maxExtensionVelocity', 'duration'] as const;
export const metricSchema = z.enum(metricKeys);
export type MetricKey = z.infer<typeof metricSchema>;
export const categorySchema = z.enum(['mobility', 'strength', 'balance', 'functional', 'jump', 'sport']);
export const exerciseSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), categories: z.array(categorySchema).min(1),
  description: z.string(), limitation: z.string().optional(), camera: z.literal('sagittal'),
  primarySignal: z.literal('kneeFlexion'),
  instructions: z.object({ seeking: z.string(), ready: z.string(), eccentric: z.string(), concentric: z.string(), pause: z.string(), tempoOrder: z.tuple([z.enum(['eccentric','concentric']), z.literal('hold'), z.enum(['eccentric','concentric'])]).refine(keys => keys[0] !== keys[2]), cycle: z.tuple([z.string(), z.string(), z.string()]) }),
  detector: z.object({ kind: z.enum(['squat', 'sitToStand']).default('squat'), seatedMin: z.number().min(40).max(140).optional(), extension: z.number().min(0), start: z.number().positive(), minROM: z.number().positive(), reversal: z.number().positive(), minPhaseMs: z.number().positive(), minRepMs: z.number().positive(), maxRepMs: z.number().positive() }).refine(d => d.extension < d.start && d.minRepMs < d.maxRepMs && (d.kind !== 'sitToStand' || (d.seatedMin !== undefined && d.seatedMin > d.start + d.reversal))),
});
const librarySchema = z.object({
  categories: z.array(z.object({ id: categorySchema, name: z.string() })),
  metrics: z.array(z.object({ id: metricSchema, label: z.string(), unit: z.string() })),
  feedback: z.object({ below: z.string(), within: z.string(), above: z.string() }),
  exercises: z.array(exerciseSchema),
});
export const ExerciseLibrary = librarySchema.parse(library);
export type Exercise = z.infer<typeof exerciseSchema>;
