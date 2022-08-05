const { freeze } = Object;

module.exports = freeze({
  COUNCILS: freeze(['ambassador-council', 'grants-council', 'spartan-council', 'treasury-council']),
  ElectionPeriod: freeze({
    Administration: 0,
    Nomination: 1,
    Vote: 2,
    Evaluation: 3,
  }),
});
