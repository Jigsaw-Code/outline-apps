/*

Queue.js

A function to represent a queue

Created by Kate Morley - http://code.iamkate.com/ - and released under the terms
of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

*/

var MAX_UNUSED_ARRAY_SIZE = 10000

/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
function Queue() {

  // initialise the queue and offset
  var queue = []
  var offset = 0

  // Returns the length of the queue.
  this.getLength = function () {
    return (queue.length - offset)
  }

  /* Enqueues the specified item. The parameter is:
   *
   * item - the item to enqueue
   */
  this.enqueue = function (item) {
    queue.push(item)
  }

  /* Dequeues an item and returns it. If the queue is empty, the value
   * 'undefined' is returned.
   */
  this.dequeue = function () {

    // if the queue is empty, return immediately
    if (queue.length === 0) {
      return undefined
    }

    // store the item at the front of the queue
    var item = queue[offset]

    // increment the offset and remove the free space if necessary
    if (++offset > MAX_UNUSED_ARRAY_SIZE) {
      queue = queue.slice(offset)
      offset = 0
    }

    // return the dequeued item
    return item

  }
}

module.exports = Queue
