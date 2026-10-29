import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Plus,
  Upload,
  CheckCircle2,
  X,
  AlertTriangle,
  Camera,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Phone,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Trash2,
  Battery,
  Package,
  Wrench,
  Check,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";

interface CustomerSellSectionProps {
  initialView?: "form" | "listings";
}

export const CustomerSellSection: React.FC<CustomerSellSectionProps> = ({ initialView = "listings" }) => {
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [showCreateForm, setShowCreateForm] = useState(initialView === "form");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Laptops & Computers");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [ageYears, setAgeYears] = useState("2");
  const [condition, setCondition] = useState<"WORKING" | "PARTIALLY_WORKING" | "DAMAGED" | "NOT_WORKING">("WORKING");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [description, setDescription] = useState("");
  const [damageDetails, setDamageDetails] = useState("");
  const [accessories, setAccessories] = useState<string[]>(["Charger / Power Adapter"]);
  const [batteryHealthState, setBatteryHealthState] = useState<"NORMAL" | "REPLACE_SOON" | "SERVICE" | "UNKNOWN">("NORMAL");
  const [batteryCapacity, setBatteryCapacity] = useState("88");
  const [batteryCycleCount, setBatteryCycleCount] = useState("210");
  const [batteryNotes, setBatteryNotes] = useState("Holds charge for full working day (~5-6 hours)");

  const [pickupAddress, setPickupAddress] = useState("");
  const [approximateLocation, setApproximateLocation] = useState("Indiranagar, Bengaluru");
  const [customerPhone, setCustomerPhone] = useState("+91 98765 43210");
  const [preferredPickupDate, setPreferredPickupDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [preferredPickupTimeSlot, setPreferredPickupTimeSlot] = useState("Morning (9 AM - 1 PM)");
  const [latitude, setLatitude] = useState<number | undefined>(12.9784);
  const [longitude, setLongitude] = useState<number | undefined>(77.6408);
  const [images, setImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
  ]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Offers Drawer / Modal
  const [selectedListingForOffers, setSelectedListingForOffers] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Cancellation Modal
  const [cancelModalListing, setCancelModalListing] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const commonAccessories = [
    "Charger / Power Adapter",
    "Original Packaging Box",
    "Purchase Bill / Invoice",
    "Protective Sleeve / Case",
    "External Mouse / Keyboard",
    "Connecting Cables",
  ];

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setRefreshing(true);
      const res = await api.getMyListings();
      if (res.success) {
        setMyListings(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load customer listings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleAccessory = (acc: string) => {
    setAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  // Browser GPS detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        if (!approximateLocation) {
          setApproximateLocation(`Near GPS (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`);
        }
      },
      (err) => {
        alert(`Location permission denied or unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setFormError(null);

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const res = await api.uploadEvidence(files[i]);
        if (res.success && res.file?.url) {
          newUrls.push(res.file.url);
        }
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      setFormError(err.message || "Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate concurrent submissions
    setFormError(null);
    setDescriptionError(null);
    setFormSuccess(null);

    const trimmedBrand = brand.trim();
    const trimmedModel = model.trim();
    const trimmedCategory = category.trim();
    const trimmedDescription = description.trim();

    let hasValidationError = false;

    if (!trimmedDescription) {
      setDescriptionError("General description is required to help inspectors and circular buyers assess your device.");
      hasValidationError = true;
    }

    if (!trimmedBrand || !trimmedModel || !trimmedCategory || !expectedPrice || Number(expectedPrice) <= 0) {
      setFormError("Please fill in mandatory fields: Brand, Model, Category, Expected Price (> 0), and General Description.");
      hasValidationError = true;
    } else if (!trimmedDescription) {
      setFormError("General description is mandatory. Please provide details about the device condition or history.");
    }

    if (hasValidationError) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: title.trim() || `${trimmedBrand} ${trimmedModel}`,
        category: trimmedCategory,
        brand: trimmedBrand,
        model: trimmedModel,
        ageYears: Number(ageYears) || 0,
        condition,
        expectedPrice: Number(expectedPrice),
        description: trimmedDescription,
        generalDescription: trimmedDescription,
        damageDetails: damageDetails.trim() || "None declared by seller",
        accessories,
        batteryInfo: {
          healthState: batteryHealthState,
          maxCapacityPercent: batteryCapacity ? Number(batteryCapacity) : undefined,
          cycleCount: batteryCycleCount ? Number(batteryCycleCount) : undefined,
          batteryNotes: batteryNotes.trim(),
        },
        pickupAddress: pickupAddress.trim() || approximateLocation.trim() || "Indiranagar, Bengaluru",
        approximateLocation: approximateLocation.trim() || "Indiranagar, Bengaluru",
        latitude,
        longitude,
        preferredPickupDate,
        preferredPickupTimeSlot,
        customerPhone: customerPhone.trim(),
        images: images.length > 0 ? images : ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80"],
        listingType: "P2P_MARKETPLACE",
      };

      const res = await api.createListing(payload);
      if (res.success) {
        setFormSuccess(
          "Used device submitted successfully! Status is 'Pending Inspection'. It will undergo certified review before publishing live on the Circular Marketplace."
        );
        setShowCreateForm(false);
        // Reset form
        setTitle("");
        setBrand("");
        setModel("");
        setExpectedPrice("");
        setDescription("");
        setDescriptionError(null);
        setDamageDetails("");
        loadListings();
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  };

  // Publish Approved Listing to Marketplace
  const handlePublishListing = async (listingId: string) => {
    setActionLoading(true);
    try {
      const res = await api.publishListing(listingId);
      if (res.success) {
        alert("Success! Your device has been published live to the Circular Marketplace for peer purchase.");
        loadListings();
      }
    } catch (err: any) {
      alert(err.message || "Failed to publish listing.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!confirm("Are you sure you want to accept this offer? A secure 6-digit pickup OTP will be generated.")) return;
    setActionLoading(true);
    try {
      const res = await api.acceptOffer(offerId);
      if (res.success) {
        alert(
          `Offer accepted! Your Handover OTP is: ${res.data.handoverOtp}\nKeep this safe and share with the collection driver only when your device is collected.`
        );
        setSelectedListingForOffers(null);
        loadListings();
      }
    } catch (err: any) {
      alert(err.message || "Failed to accept offer");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    const reason = prompt("Enter optional reason for declining this offer:");
    setActionLoading(true);
    try {
      const res = await api.rejectOffer(offerId, reason || undefined);
      if (res.success) {
        loadListings();
        if (selectedListingForOffers) {
          setSelectedListingForOffers((prev: any) => ({
            ...prev,
            offers: prev.offers.map((o: any) => (o.offerId === offerId ? { ...o, status: "REJECTED" } : o)),
          }));
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to decline offer");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelListing = async () => {
    if (!cancelModalListing) return;
    setActionLoading(true);
    try {
      const res = await api.cancelListing(cancelModalListing.listingId, cancelReason);
      if (res.success) {
        setCancelModalListing(null);
        setCancelReason("");
        loadListings();
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel listing");
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_INSPECTION":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Inspection
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved by Review
          </span>
        );
      case "LISTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5" />
            Live on Marketplace
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Review Rejected
          </span>
        );
      case "SOLD":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sold to Buyer (Owner 2)
          </span>
        );
      default:
        return <Badge status={status as any} size="sm" />;
    }
  };

  return (
    <div id="customer-sell-section" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Peer-to-Peer & Refurbished Marketplace
          </span>
          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Sell Your Used Electronics</h2>
          <p className="text-xs text-[#6B7C74] mt-1 max-w-xl">
            List pre-owned laptops, smartphones, and gear directly for circular sale. Devices undergo transparent inspection review before being published.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadListings()}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[#D7E5DB] bg-white text-[#173C32] hover:bg-[#EDF7EF] transition-all"
            title="Refresh listings"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#075B46]" : ""}`} />
          </button>

          <button
            id="create-listing-toggle-btn"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setFormError(null);
              setDescriptionError(null);
              setFormSuccess(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm transition-all"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreateForm ? "Close Form" : "List a Device for Sale"}</span>
          </button>
        </div>
      </div>

      {formSuccess && (
        <div className="p-4 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* CREATE LISTING FORM */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-sm space-y-6">
          <div className="border-b border-[#D7E5DB] pb-3">
            <h3 className="text-base font-serif text-[#173C32]">Device Specifications, Condition & Battery Assessment</h3>
            <p className="text-xs text-[#6B7C74]">
              Accurate reporting ensures swift review approval. Your listing will only appear in the public marketplace once reviewed.
            </p>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form id="sell-old-product-form" onSubmit={handleCreateListing} className="space-y-5">
            {/* Row 1: Title, Category, Brand */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Product Title</label>
                <input
                  id="listing-title"
                  type="text"
                  placeholder="e.g. Dell Latitude 7420 Ultrabook"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Category *</label>
                <select
                  id="listing-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                >
                  <option value="Laptops & Computers">Laptops & Computers</option>
                  <option value="Smartphones & Tablets">Smartphones & Tablets</option>
                  <option value="Monitors & Displays">Monitors & Displays</option>
                  <option value="Audio & Accessories">Audio & Accessories</option>
                  <option value="Consumer Electronics">Consumer Electronics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Brand *</label>
                <input
                  id="listing-brand"
                  type="text"
                  placeholder="e.g. Apple, Dell, Lenovo, HP"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>
            </div>

            {/* Row 2: Model, Age, Condition, Price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Model / Technical Specs *</label>
                <input
                  id="listing-model"
                  type="text"
                  placeholder="e.g. Core i7, 16GB RAM, 512GB SSD"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Usage Age (Years)</label>
                <input
                  id="listing-age"
                  type="number"
                  min="0"
                  max="25"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Operating Condition *</label>
                <select
                  id="listing-condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                >
                  <option value="WORKING">Working (Full functional pass)</option>
                  <option value="PARTIALLY_WORKING">Partially Working (Minor cosmetic/audio flaw)</option>
                  <option value="DAMAGED">Damaged (Casing defect or scratch)</option>
                  <option value="NOT_WORKING">Requires Servicing / Defective</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Expected Selling Price (₹) *</label>
                <input
                  id="listing-price"
                  type="number"
                  min="1"
                  placeholder="e.g. 28000"
                  value={expectedPrice}
                  onChange={(e) => setExpectedPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>
            </div>

            {/* Damage Details & Visible Defects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="listing-description" className="block text-xs font-semibold text-[#173C32]">
                    General Description <span className="text-red-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-[#6B7C74]">Mandatory for review</span>
                </div>
                <textarea
                  id="listing-description"
                  name="description"
                  rows={2}
                  required
                  placeholder="Provide details about previous usage, software reset, packaging, etc."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descriptionError) setDescriptionError(null);
                    if (formError) setFormError(null);
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none transition-colors ${
                    descriptionError
                      ? "border-red-400 bg-red-50/30 focus:border-red-500"
                      : "border-[#D7E5DB] focus:border-[#075B46]"
                  }`}
                />
                {descriptionError && (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{descriptionError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">
                  Damage Details & Visible Defects (Separated for Buyer Transparency)
                </label>
                <textarea
                  id="listing-damage-details"
                  rows={2}
                  placeholder="e.g. Light scuff on corner bevel; screen and keyboard in pristine condition."
                  value={damageDetails}
                  onChange={(e) => setDamageDetails(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>
            </div>

            {/* Accessories Checklist */}
            <div className="p-4 rounded-xl bg-[#EDF7EF]/60 border border-[#D7E5DB] space-y-2">
              <label className="block text-xs font-bold text-[#173C32]">Included Accessories</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {commonAccessories.map((acc) => {
                  const isChecked = accessories.includes(acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => handleToggleAccessory(acc)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs border text-left transition-all ${
                        isChecked
                          ? "bg-white border-[#087F5B] text-[#075B46] font-semibold shadow-xs"
                          : "bg-white/50 border-[#D7E5DB] text-[#6B7C74]"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-[#6B7C74] shrink-0" />
                      )}
                      <span className="truncate">{acc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available Battery Information */}
            <div className="p-4 rounded-xl bg-[#EDF7EF]/60 border border-[#D7E5DB] space-y-3">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-[#075B46]" />
                <span className="text-xs font-bold text-[#173C32]">Available Battery Diagnostics (Optional / If Known)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Reported Health State</label>
                  <select
                    value={batteryHealthState}
                    onChange={(e) => setBatteryHealthState(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="NORMAL">Normal (Healthy capacity)</option>
                    <option value="REPLACE_SOON">Replace Soon (Degraded)</option>
                    <option value="SERVICE">Service Required</option>
                    <option value="UNKNOWN">Not Known / Desktop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Max Capacity (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    placeholder="e.g. 88"
                    value={batteryCapacity}
                    onChange={(e) => setBatteryCapacity(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Cycle Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 210"
                    value={batteryCycleCount}
                    onChange={(e) => setBatteryCycleCount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Battery Performance Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Delivers approx 5 hours continuous web browsing"
                  value={batteryNotes}
                  onChange={(e) => setBatteryNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                />
              </div>
            </div>

            {/* Photos Upload & Samples */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#173C32]">Product Photos (High-resolution recommended)</label>
              <div className="flex flex-wrap items-center gap-3">
                {images.map((imgUrl, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D7E5DB] group shadow-xs">
                    <img src={imgUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-[#D7E5DB] hover:border-[#075B46] flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#F7FBF7]">
                  <Camera className="w-5 h-5 text-[#6B7C74]" />
                  <span className="text-[10px] text-[#6B7C74] mt-1 font-medium">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>

                {uploadingImage && (
                  <div className="flex items-center gap-1.5 text-xs text-[#075B46]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Approximate Location & Privacy */}
            <div className="p-4 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#075B46]" />
                <span className="text-xs font-bold text-[#173C32]">Privacy Protection & Approximate Location</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#173C32] mb-1">
                    Approximate Neighborhood (Public on Marketplace)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="listing-approx-loc"
                      type="text"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={approximateLocation}
                      onChange={(e) => setApproximateLocation(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                    />
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      className="px-3 py-2 rounded-xl bg-white border border-[#D7E5DB] hover:bg-[#E5F5EA] text-[#075B46] text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{latitude ? "GPS Saved" : "Use GPS"}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#6B7C74] mt-1">
                    * Exact address is never shown publicly. Only approximate neighborhood is shared.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173C32] mb-1">
                    Pickup Street Address (Strictly Private)
                  </label>
                  <input
                    id="listing-address"
                    type="text"
                    placeholder="Apartment/House, Street, Area, City"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                  />
                  <p className="text-[11px] text-[#6B7C74] mt-1">
                    Used solely for verified logistics courier dispatch if an order is confirmed.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74] hover:bg-[#EDF7EF]"
              >
                Cancel
              </button>
              <button
                id="submit-listing-btn"
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Device for Inspection Review</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MY LISTINGS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-serif text-[#173C32]">My Registered Devices ({myListings.length})</h3>
            <p className="text-xs text-[#6B7C74]">
              Lifecycle: Pending Inspection → Approved → Listed → Sold. Listings must be approved before publication.
            </p>
          </div>
          <button
            onClick={() => loadListings()}
            className="text-xs text-[#075B46] hover:underline flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#6B7C74]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#075B46] mb-2" />
            Loading your electronic listings...
          </div>
        ) : myListings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EDF7EF] text-[#075B46] flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-sm font-serif text-[#173C32]">No devices listed for sale yet</p>
            <p className="text-xs text-[#6B7C74] max-w-sm mx-auto">
              Have unused electronics? Submit them for review and list them in the peer-to-peer Circular Marketplace.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#075B46] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>List a Device Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {myListings.map((item) => {
              const isApproved = item.status === "APPROVED";
              const isListed = item.status === "LISTED";
              const isPending = item.status === "PENDING_INSPECTION" || item.status === "SUBMITTED";
              const isSold = item.status === "SOLD";
              const isRejected = item.status === "REJECTED";

              return (
                <div
                  key={item.listingId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm hover:border-[#087F5B]/40 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D7E5DB]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#075B46]">{item.listingId}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-[#6B7C74]">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-[#173C32] mt-1">{item.title}</h4>
                      <p className="text-xs text-[#6B7C74]">
                        {item.brand} • Model: {item.model} • Age: {item.ageYears} yrs • Condition: {item.condition}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="text-xs text-[#6B7C74]">Target Price</span>
                      <span className="text-lg font-bold text-[#075B46]">₹{item.expectedPrice?.toLocaleString()}</span>
                      <div>{renderStatusBadge(item.status)}</div>
                    </div>
                  </div>

                  {/* Specification & Transparency Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#EDF7EF]/50 border border-[#D7E5DB]">
                      <span className="text-[10px] text-[#6B7C74] font-semibold block uppercase">Damage Details</span>
                      <span className="text-[#173C32]">{item.damageDetails || "None declared"}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#EDF7EF]/50 border border-[#D7E5DB]">
                      <span className="text-[10px] text-[#6B7C74] font-semibold block uppercase">Accessories Included</span>
                      <span className="text-[#173C32]">
                        {item.accessories && item.accessories.length > 0 ? item.accessories.join(", ") : "Device only"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#EDF7EF]/50 border border-[#D7E5DB]">
                      <span className="text-[10px] text-[#6B7C74] font-semibold block uppercase">Battery Status</span>
                      <span className="text-[#173C32]">
                        {item.batteryInfo?.healthState || "Not recorded"}{" "}
                        {item.batteryInfo?.maxCapacityPercent ? `(${item.batteryInfo.maxCapacityPercent}%)` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Status Banners & Actions */}
                  {isPending && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Pending Inspection Review: </span>
                        <span>
                          Your device is queued for review by certified hardware specialists. You will be notified once review is complete.
                        </span>
                      </div>
                    </div>
                  )}

                  {isApproved && (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-blue-950">Pre-Listing Inspection Passed & Approved!</p>
                          <p className="text-blue-800 mt-0.5">
                            {item.reviewNotes || "Device meets circular quality requirements. Ready to be published to marketplace."}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePublishListing(item.listingId)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm transition-all shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Publish to Marketplace</span>
                      </button>
                    </div>
                  )}

                  {isListed && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Live on Circular Marketplace: </strong>
                          Customers can now browse, inspect diagnostic history, and purchase this device.
                        </span>
                      </div>
                    </div>
                  )}

                  {isRejected && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Review Declined: </span>
                        <span>{item.reviewNotes || "Does not meet marketplace condition thresholds."}</span>
                      </div>
                    </div>
                  )}

                  {isSold && (
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>
                        <strong>Sold & Transferred: </strong>
                        Device has been purchased by Owner 2 (Verified Buyer). Legal title successfully transferred.
                      </span>
                    </div>
                  )}

                  {/* Footer Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6B7C74] pt-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#087F5B]" />
                        <span>Pickup Location: {item.approximateLocation}</span>
                      </span>
                      {item.reviewedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#087F5B]" />
                          <span>Reviewed: {new Date(item.reviewedAt).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {["PENDING_INSPECTION", "SUBMITTED", "APPROVED"].includes(item.status) && (
                        <button
                          onClick={() => setCancelModalListing(item)}
                          className="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-all"
                        >
                          Cancel Listing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CANCELLATION MODAL */}
      {cancelModalListing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-md w-full p-6 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-[#173C32]">Cancel Electronic Listing?</h4>
            <p className="text-xs text-[#6B7C74]">
              Are you sure you want to cancel listing <strong>{cancelModalListing.title}</strong>?
            </p>
            <input
              type="text"
              placeholder="Reason for cancellation (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalListing(null)}
                className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74]"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelListing}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
