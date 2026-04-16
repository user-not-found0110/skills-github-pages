#!/data/data/com.termux/files/usr/bin/bash
# setup-termux.sh — sets up the build environment for MissedCallSMS in Termux (ARM64)
set -e

echo "=== MissedCallSMS Termux Build Setup ==="
echo ""

# 1. Install required packages
echo "[1/5] Installing Java 17 and Gradle..."
pkg install -y openjdk-17 gradle git 2>/dev/null || {
    echo "Note: If 'openjdk-17' is not found, run: pkg upgrade && pkg install openjdk-17"
}

# 2. Set JAVA_HOME
export JAVA_HOME="$PREFIX/lib/jvm/java-17-openjdk"
echo "JAVA_HOME=$JAVA_HOME"
echo "export JAVA_HOME=\"$JAVA_HOME\"" >> ~/.bashrc

# 3. Download ARM64-compatible aapt2 and d8 from lzhiyong/android-sdk-tools
echo ""
echo "[2/5] Downloading ARM64 Android build tools..."
echo "      (These replace the x86_64 tools Gradle would normally download)"
echo ""

ARM64_TOOLS_DIR="$HOME/.android-sdk-tools-arm64"
mkdir -p "$ARM64_TOOLS_DIR"

# Latest release from https://github.com/lzhiyong/android-sdk-tools/releases
TOOLS_BASE_URL="https://github.com/lzhiyong/android-sdk-tools/releases/download/34.0.0"

# Download aapt2
if [ ! -f "$ARM64_TOOLS_DIR/aapt2" ]; then
    echo "Downloading aapt2 for ARM64..."
    curl -L "$TOOLS_BASE_URL/aapt2" -o "$ARM64_TOOLS_DIR/aapt2" || {
        echo ""
        echo "ERROR: Could not download aapt2."
        echo "Please visit https://github.com/lzhiyong/android-sdk-tools/releases"
        echo "and manually download 'aapt2' to $ARM64_TOOLS_DIR/aapt2"
        exit 1
    }
    chmod +x "$ARM64_TOOLS_DIR/aapt2"
fi

# Download d8
if [ ! -f "$ARM64_TOOLS_DIR/d8.jar" ]; then
    echo "Downloading d8.jar..."
    curl -L "$TOOLS_BASE_URL/d8.jar" -o "$ARM64_TOOLS_DIR/d8.jar" || {
        echo "d8.jar not available separately — will use Gradle's bundled version."
    }
fi

echo "ARM64 tools ready at $ARM64_TOOLS_DIR"

# 4. Run an initial Gradle build to populate the cache (will fail, that's OK)
echo ""
echo "[3/5] Running initial Gradle sync to populate dependency cache..."
echo "      (Build will fail — that is expected at this step)"
echo ""
cd "$(dirname "$0")"
./gradlew --no-daemon :app:preBuild 2>&1 | tail -20 || true

# 5. Patch aapt2 in the Gradle cache (replace x86_64 binary with ARM64 one)
echo ""
echo "[4/5] Patching Gradle cache: replacing x86_64 aapt2 with ARM64 version..."
AAPT2_ARM64="$ARM64_TOOLS_DIR/aapt2"

find "$HOME/.gradle/caches" -name "aapt2-*.jar" 2>/dev/null | while read jar; do
    echo "Patching: $jar"
    TMP_DIR=$(mktemp -d)
    cp "$jar" "$TMP_DIR/original.jar"
    cd "$TMP_DIR"
    unzip -o original.jar aapt2 2>/dev/null || true
    if [ -f "$TMP_DIR/aapt2" ]; then
        cp "$AAPT2_ARM64" "$TMP_DIR/aapt2"
        chmod +x "$TMP_DIR/aapt2"
        zip -u original.jar aapt2
        cp original.jar "$jar"
        echo "  Patched successfully."
    else
        echo "  No aapt2 binary found inside $jar, skipping."
    fi
    cd - > /dev/null
    rm -rf "$TMP_DIR"
done

# 6. Full build
echo ""
echo "[5/5] Building the APK..."
cd "$(dirname "$0")"
./gradlew --no-daemon assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK" ]; then
    echo ""
    echo "============================================"
    echo "  BUILD SUCCESSFUL!"
    echo "  APK location: $(pwd)/$APK"
    echo ""
    echo "  To install on this device via ADB:"
    echo "    adb install $APK"
    echo ""
    echo "  Or copy the APK to your Downloads folder and"
    echo "  open it with a file manager to sideload."
    echo "============================================"
else
    echo ""
    echo "Build failed. Check the output above for errors."
    echo ""
    echo "If aapt2 issues persist, try the GitHub Actions build instead:"
    echo "  Push this repo to GitHub and download the APK from the Actions tab."
fi
