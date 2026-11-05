import { z } from 'zod';
import { ExerciseLibrary, metricSchema } from './ExerciseLibrary';
export const prescriptionSchema = z.object({
  version: z.literal(1), exerciseId: z.string().refine(id => ExerciseLibrary.exercises.some(e => e.id === id)),
  sets: z.number().int().min(1).max(20), reps: z.number().int().min(1).max(100),
  tempo: z.object({ eccentric: z.number().min(0.2).max(30), hold: z.number().min(0).max(30), concentric: z.number().min(0.2).max(30) }),
  load: z.object({ type: z.enum(['bodyweight', 'kg', 'band']), value: z.number().min(0).max(500), note: z.string().max(150) }),
  camera: z.literal('sagittal'), facing: z.enum(['left', 'right']),
  timing: z.enum(['live', 'rep', 'set']), visual: z.boolean(), speech: z.boolean(),
  filter: z.object({ angleTauMs: z.number().min(0).max(1000), velocityTauMs: z.number().min(0).max(1000), minConfidence: z.number().min(0.3).max(1), maxGapMs: z.number().min(100).max(2000) }),
  parameters: z.array(z.object({ metric: metricSchema, measure: z.boolean(), feedback: z.boolean(), lower: z.number().finite(), upper: z.number().finite(), tolerance: z.number().min(0).max(50) }).refine(p => p.lower <= p.upper && (!p.feedback || p.measure), 'Controleer grenzen en activeer meten voor feedback.')).length(6)
    .refine(p => new Set(p.map(x => x.metric)).size === 6, 'Elke meetparameter moet precies één keer voorkomen.'),
});
export type ExercisePrescription = z.infer<typeof prescriptionSchema>;
export const defaultPrescription: ExercisePrescription = prescriptionSchema.parse({
  version: 1, exerciseId: 'EX001', sets: 2, reps: 5,
  tempo: { eccentric: 3, hold: 1, concentric: 2 },
  load: { type: 'bodyweight', value: 0, note: '' }, camera: 'sagittal', facing: 'right', timing: 'rep', visual: true, speech: false,
  filter: { angleTauMs: 100, velocityTauMs: 150, minConfidence: 0.65, maxGapMs: 350 },
  parameters: ExerciseLibrary.metrics.map(m => ({ metric: m.id, measure: true, feedback: m.id === 'maxKneeFlexion', lower: m.id === 'duration' ? 3 : 70, upper: m.id === 'duration' ? 8 : 90, tolerance: 3 })),
});
