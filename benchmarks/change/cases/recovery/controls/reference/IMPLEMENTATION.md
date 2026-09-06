# Implementation notes

The change is contained in src/index.ts. It retains the starter entry point, command parsing, immutable shipment fields, and queued/dispatched storage support, and adds the Beacon dependency and deferred/unavailable states.

The carrier attempt helper builds requests from the selected shipment and the current command's recipient. A separate classifier interprets the documented Atlas and Beacon rejection formats. The dispatch routine uses those outcomes to choose the next carrier or construct an invocation result. Public projections and diagnostic objects select explicit business fields.

Deferred records retain nextProvider, retryAtMs, and ordered rejection context as JSON data. The dispatch routine reads that data before deciding whether the supplied nowMs permits another attempt. The commit helper awaits repository.save before emitting the corresponding decision event or response. Abort responses and events are assembled without raw dependency metadata.

The implementation uses the starter package.json and tsconfig.json. No additional dependency is needed.
