
Tab Logger
==========


Description
-----------

The `Tab Logger` chrome extension helps users incrementing their productivity by raising awareness of their tab usage. Users can visualize simple statistics such as the average number of open tabs and the median lifetime of a tab, realizing the inefficiencies of their tab behavior. In addition, the `Tab logger` extension can reduce memory utilization by suspending tabs that have been inactive for a long time. Putting inactive tabs to sleep is especially useful for resource-constrained users who keep long lists of tabs open. For such an intensive tab usage, the `Tab logger` user interface provides a shortcut to close all tabs except the active one.

Users that benefit from this extension can also contribute to research on computer security by sending statistics about their tab usage. Even thoguh there already are a few studies on the usage of browser tabs, these studies have been performed from a usability point of view, and are not suitable for computer security studies. The following list provides the reader with references to previous studies on this topic.

* Patrick Dubroy; and Ravin Balakrishnan, ["A Study of Tabbed Browsing Among Mozilla Firefox Users"](http://dubroy.com/research/chi2010-a-study-of-tabbed-browsing.pdf), SIGCHI Conference on Human Factors in Computing Systems, p. 673-682, 2010.

* Christian von der Weth; and Manfred Hauswirth, ["DOBBS: Towards a Comprehensive Dataset to Study the Browsing Behavior of Online Users"](http://arxiv.org/abs/1307.1542), IEEE/WIC/ACM International Joint Conferences on Web Intelligence and Intelligent Agent Technologies, vol. 1, p. 51-56, 2013.

* Tab Studies with Firefox [Test Pilot](http://dubroy.com/blog/how-many-tabs-do-people-use-now-with-real-data).



Statistics Collection
---------------------

The extension collects the following attributes:

| Attribute                                                       | Description                                                |
| --------------------------------------------------------------- |:----------------------------------------------------------:|
| [Tab ID](https://developer.chrome.com/extensions/tabs#type-Tab) | An identifier of the tab where the event has originated.   |
| Event Name                                                      | An event related to a tab. See below for a list of events. |
| Time offset                                                     | Time elapsed between this event and the previous one.      |


These are the events that are recorded:

| Name      | Description                                                                |
| ----------|:--------------------------------------------------------------------------:|
| onCreated | The user has open a new tab.                                               |
| onUpdated | The user has updated the tab (e.g., visited a new page with the same tab). |
| onRemoved | The user has closed a tab.                                                 |
| onLoaded  | A resouce (e.g., a script, an image, and so on), has been loaded in a tab. |



Note that the URL is not collected in any case, nor any content of the visits.



Threat model
-------------

All the instances of the extension post the data to a central [web server](https://tablog-webfpext.rhcloud.com). We want to protect against inferences made on the data by network eavesdroppers and this web server. To reduce the scope of inference we minimized the data that are being collected. For instance, we record time offsets instead of absolute timestamps, in order to prevent time correlation attacks.

We use [public-key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) to encrypt the data. The extension is shipped with the public key, and encrypts the data with it. After collecting 50 events, the extension posts these data via HTTPS to a [web server](https://tablog-webfpext.rhcloud.com). The private key is kept in a secure environment, so that not even the web server can learn the contents of these data. Only the researchers who have access to this secure enviroment can recover the original data.

We used RSA-2048 with PKCSv1.5 padding, because it achieves a good security/performance tradeoff given our requirements.

The data is also stored in the HTML5 local storage associated to the extension, so that users can see them in plain text.



Links
-----

* The extension can be found at the Chrome [store](https://chrome.google.com/webstore/detail/tab-logger/ekpdejagmfcppgcbhnmlhkkjbhenjnhd).

* The actual stats are being processed and published automatically [here](https://tablog-webfpext.rhcloud.com/stats.html).



Who we are
----------

We are PhD students on computer security with the following affiliations:

* Giovanni Cherubin, Royal Holloway University of London <giovanni.cherubin@gmail.com>

* Jamie Hayes, University College London<jamie.hayes.14@ucl.ac.uk>

* Marc Juarez, ESAT/COSIC - KU Leuven <marc.juarez@kuleuven.be>

Please, contact us if you have question or comments about either the Tab Logger extension or this study.
