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