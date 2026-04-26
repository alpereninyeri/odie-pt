const BW_EXERCISE_REGEX = /\b(pull[- ]?up|chin[- ]?up|push[- ]?up|dip|muscle[- ]?up|hollow|l[- ]?sit|hang|plank|leg[ ]?raise|hlr|burpee|sit[- ]?up|squat|lunge|pistol|handstand|tuck|bridge|crunch|calf|jump|sprint|cakali|cakal|cakil|chakli|hop|skip|step[- ]?up|inverted|ring[ ]?row|bar[ ]?dip|ab[- ]?wheel|wall[- ]?walk|sandbag|farmer|bw)\b/i

export function isBodyweightExercise(name = '') {
  return BW_EXERCISE_REGEX.test(String(name).toLowerCase())
}

export function computeVolumeWithBodyweight(exercises = [], bodyWeightKg = 0) {
  const list = Array.isArray(exercises) ? exercises : []
  return Math.round(list.reduce((sum, exercise) => {
    const sets = exercise?.sets || []
    const isBW = isBodyweightExercise(exercise?.name || '')
    return sum + sets.reduce((acc, set) => {
      const reps = Number(set?.reps) || 0
      const weight = Number(set?.weight_kg ?? set?.weightKg) || 0
      if (!reps) return acc
      if (isBW && bodyWeightKg > 0) {
        return acc + ((bodyWeightKg + weight) * reps)
      }
      return acc + (weight * reps)
    }, 0)
  }, 0))
}
