import { ExerciseLibrary } from '../domain/ExerciseLibrary';
import type { ExercisePrescription } from '../domain/ExercisePrescription';
import type { Feedback, Repetition } from '../domain/types';
export class FeedbackEngine {
  evaluate(metrics: Repetition['metrics'], prescription: ExercisePrescription, quality: number): Feedback[] {
    if (quality < prescription.filter.minConfidence) return [];
    return prescription.parameters.flatMap(rule => {
      const value = metrics[rule.metric];
      if (!rule.measure || !rule.feedback || value === null || !Number.isFinite(value)) return [];
      const outcome = value < rule.lower - rule.tolerance ? 'below' : value > rule.upper + rule.tolerance ? 'above' : 'within';
      return [{ metric: rule.metric, value, outcome, tone: outcome === 'within' ? 'positive' : outcome === 'below' ? 'neutral' : 'corrective', text: ExerciseLibrary.feedback[outcome] }];
    });
  }
  forSet(repetitions: Repetition[], prescription: ExercisePrescription): Feedback[] {
    if (!repetitions.length) return [];
    const metrics = Object.fromEntries(ExerciseLibrary.metrics.map(m => {
      const values = repetitions.map(r => r.metrics[m.id]).filter((n): n is number => n !== null);
      return [m.id, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];
    })) as Repetition['metrics'];
    return this.evaluate(metrics, prescription, Math.min(...repetitions.map(r => r.quality)));
  }
}
