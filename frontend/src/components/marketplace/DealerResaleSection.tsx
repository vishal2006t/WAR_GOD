import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Plus,
  X,
  Search,
  ShieldCheck,
  RefreshCw,
  Edit3,
  ExternalLink,
  Sparkles,
  Layers,
  Cpu,
} from "lucide-react";

export const DealerResaleSection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"inspection" | "inventory">("inspection");

  // Collected Items for Inspection
  const [collectedItems, setCollectedItems] = useState<any[]>([]);
  const [loadingCollected, setLoadingCollected] = useState(true);

  // Resale Products Inventory
  const [resaleProducts, setResaleProducts] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  // Inspection Modal
  const [selectedItemForInspection, setSelectedItemForInspection] = useState<any | null>(null);
  const [cosmeticGrade, setCosmeticGrade] = useState<"A_MINT" | "B_GOOD" | "C_FAIR" | "D_HEAVILY_USED">("B_GOOD");
  const [functionalTests, setFunctionalTests] = useState({
    powerOn: true,
    displayWorks: true,
    touchOrKeysWork: true,
    batteryCharges: true,
    connectivityWorks: true,
    audioPortsWork: true,
  });
  const [decision, setDecision] = useState<
    "REUSABLE_RESALE" | "REPAIR_REQUIRED" | "RECYCLE_ONLY" | "UNSAFE_HAZARDOUS"
  >("REUSABLE_RESALE");
  const [findings, setFindings] = useState("");
  const [repairPerformed, setRepairPerformed] = useState("");
  const [suggestedResalePrice, setSuggestedResalePrice] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("3");
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  // Publish Resale Product Modal
  const [publishModalItem, setPublishModalItem] = useState<any | null>(null);
  const [resaleTitle, setResaleTitle] = useState("");
  const [resaleCategory, setResaleCategory] = useState("Laptops & Computers");
  const [resaleBrand, setResaleBrand] = useState("");
  const [resaleModel, setResaleModel] = useState("");
  const [resalePrice, setResalePrice] = useState("");
  const [resaleStock, setResaleStock] = useState("1");
  const [resaleDescription, setResaleDescription] = useState("");
  const [resaleFunctionalSummary, setResaleFunctionalSummary] = useState("");
  const [submittingPublish, setSubmittingPublish] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    loadCollectedItems();
    loadResaleInventory();
  }, []);

  const loadCollectedItems = async () => {
    setLoadingCollected(true);
    try {
      const res = await api.getCollectedItemsForInspection();
      if (res.success) {
        setCollectedItems(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load collected items:", err);
    } finally {
      setLoadingCollected(false);
    }
  };

  const loadResaleInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await api.getMyResaleProducts();
      if (res.success) {
        setResaleProducts(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load resale inventory:", err);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleOpenInspectionModal = (item: any) => {
    setSelectedItemForInspection(item);
    setFindings(item.description || "Device examined upon doorstep collection. Good overall internal condition.");
    setRepairPerformed("");
    setSuggestedResalePrice(item.expectedPrice ? Math.round(item.expectedPrice * 1.2).toString() : "");
    setWarrantyMonths("3");
    setInspectionError(null);
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForInspection) return;

    if (!findings.trim()) {
      setInspectionError("Please provide inspection findings.");
      return;
    }

    setSubmittingInspection(true);
    setInspectionError(null);

    try {
      const res = await api.createInspection({
        listingId: selectedItemForInspection.listingId,
        cosmeticGrade,
        functionalTests,
        decision,
        findings,
        repairPerformed: repairPerformed || undefined,
        suggestedResalePrice: suggestedResalePrice ? Number(suggestedResalePrice) : undefined,
        warrantyMonths: Number(warrantyMonths) || 3,
      });

      if (res.success) {
        alert(`Inspection recorded with SHA-256 verification hash: ${res.data.inspectionReportHash.slice(0, 16)}...`);
        setSelectedItemForInspection(null);
        loadCollectedItems();
      }
    } catch (err: any) {
      setInspectionError(err.message || "Failed to record inspection.");
    } finally {
      setSubmittingInspection(false);
    }
  };

  const handleOpenPublishModal = (item: any) => {
    // STRICT INSPECTION GATE CHECK
    if (!item.hasInspection) {
      alert("INSPECTION REQUIRED: This item must complete formal technical inspection before being listed for resale.");
      return;
    }

    if (item.inspection.decision === "RECYCLE_ONLY" || item.inspection.decision === "UNSAFE_HAZARDOUS") {
      alert(`CANNOT RESELL: Inspection decision was '${item.inspection.decision}'. This device is earmarked strictly for certified recycling.`);
      return;
    }

    setPublishModalItem(item);
    setResaleTitle(`${item.brand} ${item.model} (Certified Pre-Owned)`);
    setResaleCategory(item.category);
    setResaleBrand(item.brand);
    setResaleModel(item.model);
    setResalePrice(item.inspection.suggestedResalePrice?.toString() || item.expectedPrice?.toString() || "10000");
    setResaleStock("1");
    setResaleDescription(item.description || "Tested and verified pre-owned electronic device.");
    setResaleFunctionalSummary(`Cosmetic Grade: ${item.inspection.cosmeticGrade}. Functional tests passed. Includes ${item.inspection.warrantyMonths} months warranty.`);
    setPublishError(null);
  };

  const handleSubmitPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishModalItem) return;

    setSubmittingPublish(true);
    setPublishError(null);

    try {
      const res = await api.createResaleProduct({
        sourceListingId: publishModalItem.listingId,
        sourceInspectionId: publishModalItem.inspection?.inspectionId,
        title: resaleTitle,
        category: resaleCategory,
        brand: resaleBrand,
        model: resaleModel,
        description: resaleDescription,
        price: Number(resalePrice),
        conditionGrade: publishModalItem.inspection?.cosmeticGrade || "B_GOOD",
        functionalSummary: resaleFunctionalSummary,
        repairHistory: publishModalItem.inspection?.repairPerformed || "",
        warrantyMonths: publishModalItem.inspection?.warrantyMonths || 3,
        stock: Number(resaleStock) || 1,
        images: publishModalItem.images || [],
      });

      if (res.success) {
        alert("Refurbished product published to Circular Marketplace!");
        setPublishModalItem(null);
        setActiveSubTab("inventory");
        loadResaleInventory();
        loadCollectedItems();
      }
    } catch (err: any) {
      setPublishError(err.message || "Failed to publish resale product.");
    } finally {
      setSubmittingPublish(false);
    }
  };

  return (
    <div id="dealer-resale-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] mb-2">
            <Wrench className="w-3.5 h-3.5" />
            Quality Gate & Resale Operations
          </span>
          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Second-Hand Electronics Marketplace</h2>
          <p className="text-xs text-[#6B7C74] mt-0.5 max-w-xl">
            Strict circular lifecycle: Inspection required for every collected device before publishing. Prevent unverified or hazardous devices from entering customer hands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("inspection")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === "inspection"
                ? "bg-[#075B46] text-white shadow-sm"
                : "bg-white text-[#6B7C74] border border-[#D7E5DB] hover:bg-[#EDF7EF]"
            }`}
          >
            Inspection Workbench ({collectedItems.length})
          </button>
          <button
            onClick={() => setActiveSubTab("inventory")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === "inventory"
                ? "bg-[#075B46] text-white shadow-sm"
                : "bg-white text-[#6B7C74] border border-[#D7E5DB] hover:bg-[#EDF7EF]"
            }`}
          >
            Resale Inventory ({resaleProducts.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: INSPECTION WORKBENCH */}
      {activeSubTab === "inspection" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif text-[#173C32]">Collected Items Awaiting / Completed Inspection</h3>
            <span className="text-xs text-[#6B7C74]">Items delivered from doorstep collection</span>
          </div>

          {loadingCollected ? (
            <div className="p-12 text-center text-xs text-[#6B7C74]">Loading collected items...</div>
          ) : collectedItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74]">
              No collected items found. Pickups completed by your drivers will automatically appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collectedItems.map((item) => (
                <div
                  key={item.listingId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#075B46]">{item.listingId}</span>
                      <h4 className="text-sm font-bold text-[#173C32]">{item.title}</h4>
                      <p className="text-xs text-[#6B7C74]">
                        {item.brand} {item.model} • Collected: {new Date(item.collectedAt || item.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      {item.hasInspection ? (
                        <Badge
                          variant={
                            item.inspection.decision === "REUSABLE_RESALE"
                              ? "success"
                              : item.inspection.decision === "REPAIR_REQUIRED"
                              ? "secondary"
                              : "danger"
                          }
                          className="text-[10px]"
                        >
                          {item.inspection.decision}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                          Needs Inspection
                        </Badge>
                      )}
                    </div>
                  </div>

                  {item.hasInspection ? (
                    <div className="p-3 rounded-xl bg-[#EDF7EF] text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7C74]">Cosmetic Grade:</span>
                        <span className="font-bold text-[#075B46]">{item.inspection.cosmeticGrade}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7C74]">Inspection Report Hash:</span>
                        <span className="font-mono text-[10px] text-[#173C32]">
                          {item.inspection.inspectionReportHash?.slice(0, 18)}...
                        </span>
                      </div>
                      <p className="text-[#6B7C74] pt-1 border-t border-[#D7E5DB]">
                        Findings: {item.inspection.findings}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#6B7C74] italic">
                      This device has been collected from the customer. Please conduct functional test checks to grade cosmetic and internal health.
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#D7E5DB]">
                    {!item.hasInspection ? (
                      <button
                        onClick={() => handleOpenInspectionModal(item)}
                        className="px-4 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Perform Inspection</span>
                      </button>
                    ) : item.resaleProductId ? (
                      <Badge variant="outline" className="text-[10px] text-[#075B46]">
                        Published to Resale (#{item.resaleProductId})
                      </Badge>
                    ) : (
                      ["REUSABLE_RESALE", "REPAIR_REQUIRED"].includes(item.inspection.decision) && (
                        <button
                          onClick={() => handleOpenPublishModal(item)}
                          className="px-4 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Publish to Resale Marketplace</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: RESALE INVENTORY */}
      {activeSubTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif text-[#173C32]">Active Pre-Owned Electronic Inventory</h3>
            <span className="text-xs text-[#6B7C74]">Visible to customers in Circular Marketplace</span>
          </div>

          {loadingInventory ? (
            <div className="p-12 text-center text-xs text-[#6B7C74]">Loading resale inventory...</div>
          ) : resaleProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74]">
              No products published for resale yet. Complete inspections on collected devices to publish eligible inventory.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {resaleProducts.map((prod) => (
                <div
                  key={prod.resaleId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#075B46]">{prod.resaleId}</span>
                      <Badge variant="success" className="text-[10px]">
                        {prod.conditionGrade}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-bold text-[#173C32]">{prod.title}</h4>
                    <p className="text-xs text-[#6B7C74]">{prod.category} • {prod.brand}</p>
                    <p className="text-xs text-[#173C32] bg-[#EDF7EF] p-2 rounded-lg">{prod.functionalSummary}</p>
                  </div>

                  <div className="pt-3 border-t border-[#D7E5DB] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#6B7C74] block">Selling Price</span>
                      <span className="text-base font-bold text-[#075B46]">₹{prod.price.toLocaleString()}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#6B7C74] block">Stock: {prod.stock} unit(s)</span>
                      <Badge variant={prod.status === "PUBLISHED" ? "success" : "secondary"} className="text-[10px]">
                        {prod.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INSPECTION FORM MODAL */}
      {selectedItemForInspection && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">{selectedItemForInspection.listingId}</span>
                <h3 className="text-base font-serif text-[#173C32]">Product Inspection & Grading</h3>
              </div>
              <button
                onClick={() => setSelectedItemForInspection(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {inspectionError}
              </div>
            )}

            <form onSubmit={handleSubmitInspection} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Cosmetic Grading *</label>
                <select
                  value={cosmeticGrade}
                  onChange={(e) => setCosmeticGrade(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white text-xs"
                >
                  <option value="A_MINT">Grade A (Pristine, no scratches)</option>
                  <option value="B_GOOD">Grade B (Light cosmetic wear)</option>
                  <option value="C_FAIR">Grade C (Noticeable scratches / dings)</option>
                  <option value="D_HEAVILY_USED">Grade D (Heavily used)</option>
                </select>
              </div>

              {/* Functional Tests Checklist */}
              <div className="p-3.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] space-y-2">
                <span className="font-bold text-[#075B46] block">6-Point Diagnostic Verification</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#173C32]">
                  {Object.entries(functionalTests).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) =>
                          setFunctionalTests((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="rounded border-[#D7E5DB] text-[#075B46]"
                      />
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Lifecycle Decision *</label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white text-xs font-semibold"
                >
                  <option value="REUSABLE_RESALE">Reusable (Eligible for second-hand resale)</option>
                  <option value="REPAIR_REQUIRED">Repair Required (Resale after internal servicing)</option>
                  <option value="RECYCLE_ONLY">Recycle Only (Direct to raw material recovery factory)</option>
                  <option value="UNSAFE_HAZARDOUS">Unsafe / Hazardous (Battery swelling / hazard)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Inspector Findings *</label>
                <textarea
                  rows={2}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  required
                  placeholder="Thermal performance, display uniformity, battery health..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Suggested Resale Price (₹)</label>
                  <input
                    type="number"
                    value={suggestedResalePrice}
                    onChange={(e) => setSuggestedResalePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Warranty Provided (Months)</label>
                  <select
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white"
                  >
                    <option value="1">1 Month Dealer Warranty</option>
                    <option value="3">3 Months Dealer Warranty</option>
                    <option value="6">6 Months Dealer Warranty</option>
                    <option value="12">12 Months Extended Warranty</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setSelectedItemForInspection(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInspection}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm"
                >
                  {submittingInspection ? "Recording..." : "Save Cryptographic Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUBLISH RESALE PRODUCT MODAL */}
      {publishModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">
                  Insp Ref: {publishModalItem.inspection?.inspectionId}
                </span>
                <h3 className="text-base font-serif text-[#173C32]">Publish Verified Refurbished Product</h3>
              </div>
              <button
                onClick={() => setPublishModalItem(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {publishError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {publishError}
              </div>
            )}

            <form onSubmit={handleSubmitPublish} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Listing Title *</label>
                <input
                  type="text"
                  value={resaleTitle}
                  onChange={(e) => setResaleTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Resale Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={resalePrice}
                    onChange={(e) => setResalePrice(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Available Stock *</label>
                  <input
                    type="number"
                    min="1"
                    value={resaleStock}
                    onChange={(e) => setResaleStock(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Functional Summary (Disclosed to Buyers) *</label>
                <input
                  type="text"
                  value={resaleFunctionalSummary}
                  onChange={(e) => setResaleFunctionalSummary(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={resaleDescription}
                  onChange={(e) => setResaleDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setPublishModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPublish}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm"
                >
                  {submittingPublish ? "Publishing..." : "Publish to Customer Marketplace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
