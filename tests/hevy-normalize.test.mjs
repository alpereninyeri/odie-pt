import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'

test('Hevy normalization preserves cardio set distance', () => {
  const workout = {
    id: 'hevy-distance-1',
    title: 'Outdoor run',
    start_time: '2026-04-21T07:00:00.000Z',
    end_time: '2026-04-21T07:35:00.000Z',
    created_at: '2026-04-21T07:36:00.000Z',
    exercises: [
      {
        title: 'Treadmill Run',
        sets: [
          { duration_seconds: 2100, distance_meters: 5200 },
        ],
      },
    ],
  }

  const normalized = normalizeHevyWorkout(workout)

  assert.equal(normalized.distanceKm, 5.2)
  assert.equal(normalized.durationMin, 35)
  assert.ok(normalized.tags.includes('endurance'))
  assert.ok(normalized.evidence.some(item => item.includes('5.2km')))
  assert.ok(normalized.facts.some(item => item.label === 'Treadmill Run'))
  assert.equal(normalized.confidence.level, 'high')
})

test('Hevy normalization uses Istanbul local day for UTC boundary starts', () => {
  const workout = {
    id: 'hevy-boundary-1',
    title: 'Night calisthenics',
    start_time: '2026-05-30T21:30:00.000Z',
    end_time: '2026-05-30T22:10:00.000Z',
    created_at: '2026-05-30T22:12:00.000Z',
    exercises: [
      {
        title: 'Push Up',
        sets: [{ reps: 20 }],
      },
    ],
  }

  const normalized = normalizeHevyWorkout(workout)

  assert.equal(normalized.date, '2026-05-31')
  assert.equal(normalized.durationMin, 40)
})

test('Hevy normalization uses sports ontology without regressing strength types', () => {
  const cases = [
    {
      name: 'Parkour title',
      title: 'Parkour flow',
      exercises: ['Pull Up', 'Kong Vault'],
      type: 'Parkour',
      tag: 'parkour',
    },
    {
      name: 'Parkour exercise',
      title: 'Skill practice',
      exercises: ['Kong Vault'],
      type: 'Parkour',
      tag: 'parkour',
    },
    {
      name: 'Calisthenics title',
      title: 'Calisthenics',
      exercises: ['Pull Up', 'Push Up'],
      type: 'Calisthenics',
      tag: 'calisthenics',
    },
    {
      name: 'Calisthenics exercise',
      title: 'Skill practice',
      exercises: ['Front Lever'],
      type: 'Calisthenics',
      tag: 'calisthenics',
    },
    {
      name: 'Handstand walk stays Calisthenics',
      title: 'Skill practice',
      exercises: ['Handstand Walk'],
      type: 'Calisthenics',
      tag: 'calisthenics',
    },
    {
      name: 'Dağ yürüyüşü',
      title: 'Outdoor',
      exercises: ['Dağ Yürüyüşü'],
      type: 'Yürüyüş',
      tag: 'walking',
    },
    {
      name: 'Koşu title',
      title: 'Sabah Koşusu',
      exercises: ['Outdoor Cardio'],
      type: 'Koşu',
      tag: 'endurance',
    },
    {
      name: 'Bisiklet exercise',
      title: 'Cardio',
      exercises: ['Indoor Cycling'],
      type: 'Bisiklet',
      tag: 'cycling',
    },
    {
      name: 'Tırmanış exercise',
      title: 'Skill practice',
      exercises: ['Bouldering'],
      type: 'Tırmanış',
      tag: 'climbing',
    },
    {
      name: 'Mountain climber is not Tırmanış',
      title: 'Core practice',
      exercises: ['Mountain Climber'],
      type: 'Gym',
      tag: 'hevy',
    },
    {
      name: 'Push remains Push',
      title: 'Push',
      exercises: ['Bench Press'],
      type: 'Push',
      tag: 'push',
    },
    {
      name: 'Pull remains Pull',
      title: 'Pull',
      exercises: ['Lat Pulldown'],
      type: 'Pull',
      tag: 'pull',
    },
    {
      name: 'Legs remain Bacak',
      title: 'Leg Day',
      exercises: ['Leg Press'],
      type: 'Bacak',
      tag: 'legs',
    },
  ]

  for (const item of cases) {
    const normalized = normalizeHevyWorkout({
      id: `ontology-${item.name}`,
      title: item.title,
      start_time: '2026-07-27T08:00:00.000Z',
      end_time: '2026-07-27T09:00:00.000Z',
      created_at: '2026-07-27T09:01:00.000Z',
      exercises: item.exercises.map(title => ({
        title,
        sets: [{ reps: 8 }],
      })),
    })

    assert.equal(normalized.type, item.type, item.name)
    assert.ok(normalized.tags.includes(item.tag), `${item.name}: missing ${item.tag}`)
  }
})

test('90 minute Parkour Vault workout keeps the movement identity and useful tags', () => {
  const normalized = normalizeHevyWorkout({
    id: 'parkour-vault-90',
    title: 'Parkour Vault',
    start_time: '2026-07-27T08:00:00.000Z',
    end_time: '2026-07-27T09:30:00.000Z',
    created_at: '2026-07-27T09:31:00.000Z',
    exercises: [
      { title: 'Safety Vault Landing', sets: [{ reps: 8 }] },
      { title: 'Speed Vault Landing', sets: [{ reps: 8 }] },
      { title: 'Kong Vault Jump', sets: [{ reps: 6 }] },
      { title: 'Precision Jump', sets: [{ reps: 6 }] },
    ],
  })

  assert.equal(normalized.type, 'Parkour')
  assert.equal(normalized.durationMin, 90)
  assert.ok(normalized.tags.includes('parkour'))
  assert.ok(normalized.tags.includes('balance'))
  assert.ok(normalized.tags.includes('explosive'))
  assert.ok(normalized.tags.includes('legs'))
  assert.ok(!normalized.tags.includes('ski'))
  assert.ok(!normalized.tags.includes('glycolytic'))
})

test('Hevy-safe ontology matching rejects substring collisions from real exercise names', () => {
  const cases = [
    ['Floor Press', 'Push'],
    ['Cable Fly', 'Push'],
    ['Dumbbell Fly', 'Push'],
    ['Lateral Raise', 'Push'],
    ['Front Raise (Cable)', 'Push'],
    ['Bicep Curl (Cable)', 'Pull'],
    ['Oturarak Leg Curl', 'Bacak'],
    ['Goblet Squat', 'Bacak'],
    ['Hip Abduction (Makine)', 'Bacak'],
    ['Ayakta Calf Raise (Halter)', 'Bacak'],
    ['Oblique Crunch', 'Custom'],
    ['Skullcrusher', 'Push'],
  ]

  for (const [exerciseTitle, expectedType] of cases) {
    const normalized = normalizeHevyWorkout({
      id: `collision-${exerciseTitle}`,
      title: 'Akşam antrenmanı',
      start_time: '2026-07-27T18:00:00.000Z',
      end_time: '2026-07-27T19:00:00.000Z',
      created_at: '2026-07-27T19:01:00.000Z',
      exercises: [{ title: exerciseTitle, sets: [{ reps: 10 }] }],
    })

    assert.equal(normalized.type, expectedType, exerciseTitle)
  }
})

test('explicit workout title wins while specialty exercises need workout-level coverage', () => {
  const normalize = ({ id, title, exercises }) => normalizeHevyWorkout({
    id,
    title,
    start_time: '2026-07-27T18:00:00.000Z',
    end_time: '2026-07-27T19:00:00.000Z',
    created_at: '2026-07-27T19:01:00.000Z',
    exercises: exercises.map(name => ({ title: name, sets: [{ reps: 8 }] })),
  })

  assert.equal(normalize({
    id: 'title-lock-pull',
    title: 'Pull',
    exercises: ['Pull Up', 'Kong Vault'],
  }).type, 'Pull')

  assert.equal(normalize({
    id: 'generic-specialty-majority',
    title: 'Skill practice',
    exercises: ['Pull Up', 'Kong Vault'],
  }).type, 'Parkour')

  assert.equal(normalize({
    id: 'strength-majority',
    title: 'Akşam antrenmanı',
    exercises: ['Bench Press', 'Shoulder Press', 'Triceps Pushdown', 'Muscle Up'],
  }).type, 'Push')

  assert.equal(normalize({
    id: 'explicit-calisthenics',
    title: 'Calisthenics Skill',
    exercises: ['Bench Press', 'Muscle Up'],
  }).type, 'Calisthenics')

  assert.equal(normalize({
    id: 'hybrid-title-uses-exercises',
    title: 'Pull + Run Finisher',
    exercises: ['Lat Pulldown', 'Lat Pulldown', 'Treadmill Run'],
  }).type, 'Pull')
})

test('specific skill titles and Turkish sport suffixes remain authoritative', () => {
  const normalize = ({ id, title = 'Akşam antrenmanı', exercises }) => normalizeHevyWorkout({
    id,
    title,
    start_time: '2026-07-27T18:00:00.000Z',
    end_time: '2026-07-27T19:00:00.000Z',
    created_at: '2026-07-27T19:01:00.000Z',
    exercises: exercises.map(name => ({ title: name, sets: [{ reps: 8 }] })),
  })

  assert.equal(normalize({
    id: 'wall-run-title',
    title: 'Wall Run',
    exercises: ['Bench Press'],
  }).type, 'Parkour')

  assert.equal(normalize({
    id: 'front-lever-title',
    title: 'Front Lever + Bench Press',
    exercises: ['Bench Press'],
  }).type, 'Calisthenics')

  assert.equal(normalize({
    id: 'turkish-run-suffix',
    exercises: ['Sabah Koşusu'],
  }).type, 'Koşu')

  assert.equal(normalize({
    id: 'turkish-climb-suffix',
    exercises: ['Duvar Tırmanışı'],
  }).type, 'Tırmanış')

  assert.equal(normalize({
    id: 'turkish-climb-verb',
    exercises: ['Tırmanma'],
  }).type, 'Tırmanış')
})
