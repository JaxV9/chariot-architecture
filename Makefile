.PHONY: help install build build-devices build-runtime run-devices run-runtime demo clean stop-demo

# Default target: display help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for all workspaces"
	@echo "  make build           - Build all workspaces (devices and runtime)"
	@echo "  make build-devices   - Build the devices workspace"
	@echo "  make build-runtime   - Build the runtime workspace"
	@echo "  make run-devices     - Build and run the devices workspace"
	@echo "  make run-runtime     - Build and run the runtime workspace"
	@echo "  make demo            - Launch the demo in 3 separate terminal windows"
	@echo "  make clean           - Remove build artifacts (dist folders)"

install:
	npm install

build-devices:
	npm run build -w devices

build-runtime:
	npm run build -w runtime

build: build-devices build-runtime

run-devices: build-devices
	npm run start -w devices

run-runtime: build-runtime
	npm run start -w runtime

demo: build
	rm -rf ~/.matter
	npx -y concurrently -n "Devices,Runtime,Listen" -c "green,blue,magenta" \
		"make run-devices" \
		"sleep 8 && make run-runtime" \
		"sleep 12 && node runtime/dist/listen.js"

stop-demo:
	@echo "Arrêt des processus de démo Chariot..."
	@pkill -f "run-devices" || true
	@pkill -f "run-runtime" || true
	@pkill -f "dist/index.js --device" || true
	@pkill -f "dist/index.js --runtime" || true
	@pkill -f "runtime/dist/listen.js" || true
	@sleep 1


clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist

