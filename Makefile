.PHONY: help install build build-devices build-runtime run-devices run-runtime demo clean

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
	osascript -e 'tell application "Terminal" to do script "cd $(CURDIR) && make run-devices"'
	osascript -e 'tell application "Terminal" to do script "cd $(CURDIR) && sleep 3 && make run-runtime"'
	osascript -e 'tell application "Terminal" to do script "cd $(CURDIR) && sleep 6 && node runtime/dist/listen.js"'

clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist

