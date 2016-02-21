function checkArrayWarning(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
        console.warn('Native comparison of arrays in JavaScript is very slow. Provide ' +
            'a custom comparison interface in your dimension() call to improve the ' +
            'performance of crossfilter.');
    }
}

var nativeComparisonOperators = {
    name: 'native',
    lt: function _lt(a,b)   {return a < b},
    lte: function _lte(a,b) {return a <= b},
    gt: function _gt(a,b)   {return a > b},
    gte: function _gte(a,b) {return a >= b}
};
