// Algorithm designed by Vladimir Yaroslavskiy.
// Implementation based on the Dart project; see lib/dart/LICENSE for details.

var quicksort_by_implementations = {};

var quicksort = crossfilter.quicksort = quicksort_by(crossfilter_identity,
    nativeComparisonOperators);

quicksort.by = quicksort_by;

function quicksort_by(f, comparisonOperators) {
  if (!comparisonOperators) {
    comparisonOperators = nativeComparisonOperators;
  }
  var implName = comparisonOperators.name;
  if (!(implName in quicksort_by_implementations)) {
    quicksort_by_implementations[implName] = compile_quicksort_by(comparisonOperators);
  }
  return quicksort_by_implementations[implName](f, comparisonOperators);
}

function dumpObject(obj) {
  if (typeof obj == "object") {
    var values = [];
    for (var key in obj) {
      values.push(JSON.stringify(key) + ': ' + dumpObject(obj[key]))
    }

    return '{\n' + values.join(',\n') + '\n}';
  } else if (typeof obj == "string") {
    return JSON.stringify(obj);
  } else {
    return obj.toString();
  }
}

function compile_quicksort_by(comparisonOperators) {
  var code = '';

  // Inline comparisonOperators
  code += 'var comparisonOperators = ' + dumpObject(comparisonOperators) + ';\n';

  // Import insertionsort_by
  code += insertionsort_by.toString() + '\n';

  // Strip function name, arguments, opening and closing braces
  var quicksort_impl = quicksort_by_impl.toString();
  var openBrace = quicksort_impl.indexOf('{');
  var closeBrace = quicksort_impl.lastIndexOf('}');
  code += quicksort_impl.substr(openBrace + 1, closeBrace - openBrace - 1);

  return new Function('f', code);
}

function quicksort_by_impl(f, comparisonOperators) {
  var insertionsort = insertionsort_by(f, comparisonOperators);
  var lt = comparisonOperators.lt,
      gt = comparisonOperators.gt,
      lte = comparisonOperators.lte,
      gte = comparisonOperators.gte;

  var quicksort_sizeThreshold = 32;

  function sort(a, lo, hi) {
    return (hi - lo < quicksort_sizeThreshold
        ? insertionsort
        : quicksort)(a, lo, hi);
  }

  function quicksort(a, lo, hi) {
    // Compute the two pivots by looking at 5 elements.
    var sixth = (hi - lo) / 6 | 0,
        i1 = lo + sixth,
        i5 = hi - 1 - sixth,
        i3 = lo + hi - 1 >> 1,  // The midpoint.
        i2 = i3 - sixth,
        i4 = i3 + sixth;

    var e1 = a[i1], x1 = f(e1),
        e2 = a[i2], x2 = f(e2),
        e3 = a[i3], x3 = f(e3),
        e4 = a[i4], x4 = f(e4),
        e5 = a[i5], x5 = f(e5);

    var t;

    // Sort the selected 5 elements using a sorting network.
    if (gt(x1, x2)) t = e1, e1 = e2, e2 = t, t = x1, x1 = x2, x2 = t;
    if (gt(x4, x5)) t = e4, e4 = e5, e5 = t, t = x4, x4 = x5, x5 = t;
    if (gt(x1, x3)) t = e1, e1 = e3, e3 = t, t = x1, x1 = x3, x3 = t;
    if (gt(x2, x3)) t = e2, e2 = e3, e3 = t, t = x2, x2 = x3, x3 = t;
    if (gt(x1, x4)) t = e1, e1 = e4, e4 = t, t = x1, x1 = x4, x4 = t;
    if (gt(x3, x4)) t = e3, e3 = e4, e4 = t, t = x3, x3 = x4, x4 = t;
    if (gt(x2, x5)) t = e2, e2 = e5, e5 = t, t = x2, x2 = x5, x5 = t;
    if (gt(x2, x3)) t = e2, e2 = e3, e3 = t, t = x2, x2 = x3, x3 = t;
    if (gt(x4, x5)) t = e4, e4 = e5, e5 = t, t = x4, x4 = x5, x5 = t;

    var pivot1 = e2, pivotValue1 = x2,
        pivot2 = e4, pivotValue2 = x4;

    // e2 and e4 have been saved in the pivot variables. They will be written
    // back, once the partitioning is finished.
    a[i1] = e1;
    a[i2] = a[lo];
    a[i3] = e3;
    a[i4] = a[hi - 1];
    a[i5] = e5;

    var less = lo + 1,   // First element in the middle partition.
        great = hi - 2;  // Last element in the middle partition.

    // Note that for value comparison, <, <=, >= and > coerce to a primitive via
    // Object.prototype.valueOf; == and === do not, so in order to be consistent
    // with natural order (such as for Date objects), we must do two compares.
    var pivotsEqual = lte(pivotValue1, pivotValue2) && gte(pivotValue1, pivotValue2);
    if (pivotsEqual) {

      // Degenerated case where the partitioning becomes a dutch national flag
      // problem.
      //
      // [ |  < pivot  | == pivot | unpartitioned | > pivot  | ]
      //  ^             ^          ^             ^            ^
      // left         less         k           great         right
      //
      // a[left] and a[right] are undefined and are filled after the
      // partitioning.
      //
      // Invariants:
      //   1) for x in ]left, less[ : x < pivot.
      //   2) for x in [less, k[ : x == pivot.
      //   3) for x in ]great, right[ : x > pivot.
      for (var k = less; k <= great; ++k) {
        var ek = a[k], xk = f(ek);
        if (xk < pivotValue1) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          ++less;
        } else if (xk > pivotValue1) {

          // Find the first element <= pivot in the range [k - 1, great] and
          // put [:ek:] there. We know that such an element must exist:
          // When k == less, then el3 (which is equal to pivot) lies in the
          // interval. Otherwise a[k - 1] == pivot and the search stops at k-1.
          // Note that in the latter case invariant 2 will be violated for a
          // short amount of time. The invariant will be restored when the
          // pivots are put into their final positions.
          while (true) {
            var greatValue = f(a[great]);
            if (greatValue > pivotValue1) {
              great--;
              // This is the only location in the while-loop where a new
              // iteration is started.
              continue;
            } else if (greatValue < pivotValue1) {
              // Triple exchange.
              a[k] = a[less];
              a[less++] = a[great];
              a[great--] = ek;
              break;
            } else {
              a[k] = a[great];
              a[great--] = ek;
              // Note: if great < k then we will exit the outer loop and fix
              // invariant 2 (which we just violated).
              break;
            }
          }
        }
      }
    } else {

      // We partition the list into three parts:
      //  1. < pivot1
      //  2. >= pivot1 && <= pivot2
      //  3. > pivot2
      //
      // During the loop we have:
      // [ | < pivot1 | >= pivot1 && <= pivot2 | unpartitioned  | > pivot2  | ]
      //  ^            ^                        ^              ^             ^
      // left         less                     k              great        right
      //
      // a[left] and a[right] are undefined and are filled after the
      // partitioning.
      //
      // Invariants:
      //   1. for x in ]left, less[ : x < pivot1
      //   2. for x in [less, k[ : pivot1 <= x && x <= pivot2
      //   3. for x in ]great, right[ : x > pivot2
      for (var k = less; k <= great; k++) {
        var ek = a[k], xk = f(ek);
        if (lt(xk, pivotValue1)) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          ++less;
        } else {
          if (gt(xk, pivotValue2)) {
            while (true) {
              var greatValue = f(a[great]);
              if (gt(greatValue, pivotValue2)) {
                great--;
                if (great < k) break;
                // This is the only location inside the loop where a new
                // iteration is started.
                continue;
              } else {
                // a[great] <= pivot2.
                if (lt(greatValue, pivotValue1)) {
                  // Triple exchange.
                  a[k] = a[less];
                  a[less++] = a[great];
                  a[great--] = ek;
                } else {
                  // a[great] >= pivot1.
                  a[k] = a[great];
                  a[great--] = ek;
                }
                break;
              }
            }
          }
        }
      }
    }

    // Move pivots into their final positions.
    // We shrunk the list from both sides (a[left] and a[right] have
    // meaningless values in them) and now we move elements from the first
    // and third partition into these locations so that we can store the
    // pivots.
    a[lo] = a[less - 1];
    a[less - 1] = pivot1;
    a[hi - 1] = a[great + 1];
    a[great + 1] = pivot2;

    // The list is now partitioned into three partitions:
    // [ < pivot1   | >= pivot1 && <= pivot2   |  > pivot2   ]
    //  ^            ^                        ^             ^
    // left         less                     great        right

    // Recursive descent. (Don't include the pivot values.)
    sort(a, lo, less - 1);
    sort(a, great + 2, hi);

    if (pivotsEqual) {
      // All elements in the second partition are equal to the pivot. No
      // need to sort them.
      return a;
    }

    // In theory it should be enough to call _doSort recursively on the second
    // partition.
    // The Android source however removes the pivot elements from the recursive
    // call if the second partition is too large (more than 2/3 of the list).
    if (less < i1 && great > i5) {
      var lessValue, greatValue;
      while ((lessValue = f(a[less])) <= pivotValue1 && lessValue >= pivotValue1) ++less;
      while ((greatValue = f(a[great])) <= pivotValue2 && greatValue >= pivotValue2) --great;

      // Copy paste of the previous 3-way partitioning with adaptions.
      //
      // We partition the list into three parts:
      //  1. == pivot1
      //  2. > pivot1 && < pivot2
      //  3. == pivot2
      //
      // During the loop we have:
      // [ == pivot1 | > pivot1 && < pivot2 | unpartitioned  | == pivot2 ]
      //              ^                      ^              ^
      //            less                     k              great
      //
      // Invariants:
      //   1. for x in [ *, less[ : x == pivot1
      //   2. for x in [less, k[ : pivot1 < x && x < pivot2
      //   3. for x in ]great, * ] : x == pivot2
      for (var k = less; k <= great; k++) {
        var ek = a[k], xk = f(ek);
        if (xk <= pivotValue1 && xk >= pivotValue1) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          less++;
        } else {
          if (xk <= pivotValue2 && xk >= pivotValue2) {
            while (true) {
              var greatValue = f(a[great]);
              if (greatValue <= pivotValue2 && greatValue >= pivotValue2) {
                great--;
                if (great < k) break;
                // This is the only location inside the loop where a new
                // iteration is started.
                continue;
              } else {
                // a[great] < pivot2.
                if (greatValue < pivotValue1) {
                  // Triple exchange.
                  a[k] = a[less];
                  a[less++] = a[great];
                  a[great--] = ek;
                } else {
                  // a[great] == pivot1.
                  a[k] = a[great];
                  a[great--] = ek;
                }
                break;
              }
            }
          }
        }
      }
    }

    // The second partition has now been cleared of pivot elements and looks
    // as follows:
    // [  *  |  > pivot1 && < pivot2  | * ]
    //        ^                      ^
    //       less                  great
    // Sort the second partition using recursive descent.

    // The second partition looks as follows:
    // [  *  |  >= pivot1 && <= pivot2  | * ]
    //        ^                        ^
    //       less                    great
    // Simply sort it by recursive descent.

    return sort(a, less, great + 1);
  }

  return function(a, lo, hi) {
    if (a.length > 0 && comparisonOperators.name == 'native') {
      var val = f(a[0]);
      if (val && typeof val.valueOf() == 'object') {
        console.warn("Using non primitive data in dimensions with native comparison " +
            "operators is slow. Consider providing custom comparison functions in " +
            ".dimenension() call.");
        console.warn("The non primitive value was: %s", JSON.stringify(f(a[0]).valueOf()))
      } else if (val === undefined) {
        console.warn("Sorting key function returned undefined for the data element %s.",
            a[0])
      }
    }
    return sort(a, lo, hi)
  }
}


