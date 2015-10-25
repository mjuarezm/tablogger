# Copyright © 2010-2012 HTTPS Everywhere authors. All rights reserved.
# Use of this source code is governed by a GPL v2+ license that can be
# found in the LICENSE file. */

#!/bin/bash

HOST='https://src.chromium.org'
BASE='chrome/trunk/src/ui/webui/resources'
FILES='
css/chrome_shared.css
css/widgets.css
images/check.png'

for FILE in $FILES; do
	wget --force-directories --no-host-directories --cut-dirs=6 $HOST/$BASE/$FILE
done
