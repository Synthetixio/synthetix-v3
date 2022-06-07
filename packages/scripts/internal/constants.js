const K = {
  COUNCILS: ['ambassador-council', 'grants-council', 'spartan-council', 'treasury-council'],
  ElectionPeriod: {
    Administration: 0,
    Nomination: 1,
    Vote: 2,
    Evaluation: 3,
  },
};

Object.freeze(K);
Object.values(K).forEach((val) => Object.freeze(val));

module.exports = K;
