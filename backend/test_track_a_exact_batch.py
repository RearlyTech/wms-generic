"""Focused checks for exact-Batch pallet receipt and safe retry."""
from fastapi import HTTPException

import common
import mobile_routes as routes

contract = routes.api_track_a_contract()
assert contract == {
    "version": "2026-09-24.track-a-batch-v2",
    "exact_batch_required": True,
    "stock_uom": "Nos",
    "stable_command_required": True,
    "source_balance_required": True,
}


class Response:
    status_code = 200

    def __init__(self, data):
        self.data = data

    def json(self):
        return {"data": self.data}


batch = {"name": "525400000000000001000606", "item": "Shrimp 31/40 1.8 kg x 6",
         "custom_marine_trace_code": "d01 / IV 01 6.266",
         "custom_marine_source_run_id": "fe77f174-30f9-430a-9bfc-b1ade22b6ec2",
         "custom_marine_source_lot_id": "4fc62098-6616-4535-9431-1e5f30543e24"}
captured = {}

routes.resolve_batch_from_rfid = lambda tag: batch if tag == batch["name"] else None
routes.resolve_warehouse_from_rfid = lambda tag: "Marine Pallet 01 - V"
routes.erp_get = lambda doctype, name: Response(
    {"name": name, "is_group": 0} if doctype == "Warehouse"
    else {"name": name, "stock_uom": "Nos"})
routes.find_stock_entry_by_remarks = lambda key: None
routes.get_batch_source_warehouse = lambda batch_id, item: "Cold Storage Staging - V"
routes.log_wms_activity = lambda **kwargs: None


def transfer(item_code, qty, source, target, batch_no=None, idempotency_key=None):
    captured.update(item_code=item_code, qty=qty, source=source, target=target,
                    batch_no=batch_no, key=idempotency_key)
    return {"name": "MAT-TRACK-A-1"}


routes.perform_stock_transfer = transfer
body = routes.WmsReceiveSchema(item_rfid=batch["name"], pallet_id="PALLET-TAG", command_id="stable-command")
result = routes.api_wms_receive(body)
assert captured == {"item_code": batch["item"], "qty": 1.0,
                    "source": "Cold Storage Staging - V", "target": "Marine Pallet 01 - V",
                    "batch_no": batch["name"], "key": "WMS-RECEIVE:stable-command"}
assert result["batch_id"] == batch["name"] and result["source_run_id"] == batch["custom_marine_source_run_id"]
assert result["replayed"] is False
assert result["contract_version"] == contract["version"]

routes.find_stock_entry_by_remarks = lambda key: {"name": "MAT-TRACK-A-1", "docstatus": 1, "items": [{
    "item_code": batch["item"], "batch_no": batch["name"],
    "s_warehouse": "Cold Storage Staging - V", "t_warehouse": "Marine Pallet 01 - V", "qty": 1}]}
routes.get_batch_source_warehouse = lambda *_: (_ for _ in ()).throw(AssertionError("Replay read current stock"))
replayed = routes.api_wms_receive(body)
assert replayed["replayed"] is True and replayed["stock_entry"] == "MAT-TRACK-A-1"
assert replayed["contract_version"] == contract["version"]

try:
    routes.api_wms_receive(routes.WmsReceiveSchema(item_rfid="unknown", pallet_id="PALLET-TAG",
                                                   command_id="unknown-command"))
except HTTPException as error:
    assert error.status_code == 404
else:
    raise AssertionError("An Item fallback was accepted as a carton Batch.")

common.resolve_latest_doc = lambda *_args, **_kwargs: "vishwha"
common.erp_get = lambda doctype, name: Response(
    {"name": name, "item": "ANOTHER ITEM"} if doctype == "Batch" else {"name": name})
try:
    common.perform_stock_transfer(batch["item"], 1, "Stores - V", "Marine Pallet 01 - V",
                                  batch_no=batch["name"])
except HTTPException as error:
    assert error.status_code == 409
    assert error.detail == "Carton Batch does not belong to this Item."
else:
    raise AssertionError("A Batch was allowed to move under the wrong Item.")

print("WMS exact-Batch carton transfer and stable replay passed.")
