/* This module allows to test the extension by checking out the test branch and
   running the tests in the test/ directory.
 */
/**
 * This function is supposed to be different in the test branch.
 */
function setSendStats(msg) {
<<<<<<< HEAD
    return true;
}
=======
    return window.confirm(msg);
}
>>>>>>> master
