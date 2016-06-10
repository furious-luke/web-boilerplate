#!/bin/bash
mv _project_ $1
mv $1/_project_ $1/$1
find . -type f -not -name setup_project.sh | xargs grep -l _project_ | xargs -n 1 sed -i "" "s/_project_/$1/g"
