#!/bin/bash
find . -type f | xargs grep -l wbtest | xargs -n 1 sed -i "" "s/wbtest/$1/g"
