# Script below syncs the google devtools frontend git repo, builds it,
# and then copies it into the "devtools-frontend" folder
#
# NOTE: script requires depot_tools
#       https://commondatastorage.googleapis.com/chrome-infra-docs/flat/depot_tools/docs/html/depot_tools_tutorial.html#_setting_up

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

VENDOR_DIR="$SCRIPT_DIR/../vendor"
DEVTOOLS_FRONTEND_DIR="$VENDOR_DIR/chromium/devtools-frontend"

if [ -d "$DEVTOOLS_FRONTEND_DIR" ]; then
  echo "$DEVTOOLS_FRONTEND_DIR exists."
else
  cd $VENDOR_DIR
  mkdir chromium
  cd chromium
  fetch devtools-frontend
fi

cd $DEVTOOLS_FRONTEND_DIR
gclient sync
npm run build

# FIXME: should link instead of copy
cp -R $DEVTOOLS_FRONTEND_DIR/out/Default/gen/front_end $VENDOR_DIR/devtools-frontend
