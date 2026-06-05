import { Template } from 'e2b'

export const template = Template()
  .fromImage('e2bdev/code-interpreter:latest')
  .setUser('root')
  .setWorkdir('/')
  .setEnvs({
    'DEBIAN_FRONTEND': 'noninteractive',
  })
  .setUser('root')
  .runCmd('apt-get update && apt-get install -y --no-install-recommends zip unzip wget ca-certificates openjdk-21-jre-headless && rm -rf /var/lib/apt/lists/*')
  .runCmd('npm install -g esbuild')
  .runCmd('npm install -g @babylonjs/core')
  .runCmd('npm install -g playwright && npx playwright install --with-deps chromium')
  // Godot binary (download → unzip → place → delete zip immediately to save disk)
  .runCmd('set -e; wget -q "https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip" -O /tmp/godot.zip && unzip -q /tmp/godot.zip -d /tmp/godot && mv /tmp/godot/Godot_v4.3-stable_linux.x86_64 /usr/local/bin/godot && chmod +x /usr/local/bin/godot && rm -rf /tmp/godot.zip /tmp/godot')
  // Godot export templates. /tmp and /dev/shm are only 493MB (the ~1GB .tpz
  // overflows them → wget exit 3). The root fs has 8GB free, so download into
  // the persistent templates dir itself, extract only the Web preset, delete it.
  .runCmd('set -e; mkdir -p /root/.local/share/godot/export_templates/4.3.stable && cd /root/.local/share/godot/export_templates/4.3.stable && wget -q "https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_export_templates.tpz" -O t.tpz && unzip -q -j t.tpz "templates/web_*" -d . && rm -f t.tpz')
  .runCmd('wget -q "https://raw.githubusercontent.com/gzuidhof/coi-serviceworker/master/coi-serviceworker.js" -O /opt/coi-serviceworker.js')
  .runCmd('wget "https://github.com/defold/defold/releases/download/1.9.8/bob.jar" -O /opt/bob.jar')
  .runCmd('node --version && esbuild --version && zip --version >/dev/null && java -version && godot --version && test -f /opt/bob.jar && test -f /opt/coi-serviceworker.js')
  .setWorkdir('/home/user')