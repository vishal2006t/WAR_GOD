import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  MapPin,
  Search,
  Filter,
  DollarSign,
  Truck,
  CheckCircle2,
  X,
  AlertTriangle,
  RefreshCw,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Phone,
  Calendar,
  Layers,
} from "lucide-react";
import { GoogleTrackingMap } from "../maps/GoogleTrackingMap";

export const DealerNearbyListingsSection: React.FC = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Geo & Map State
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("Click to detect GPS");
  const [showRegionalMap, setShowRegionalMap] = useState<boolean>(false);
  const [expandedMapListingId, setExpandedMapListingId] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState("ALL");
  const [condition, setCondition] = useState("ALL");
  const [maxDistanceKm, setMaxDistanceKm] = useState("50");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [offerModalListing, setOfferModalListing] = useState<any | null>(null);
  const [offeredPrice, setOfferedPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [estimatedPickupHours, setEstimatedPickupHours] = useState("24");
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);

  // Driver Assignment Modal (for listings where this dealer's offer is accepted)
  const [assignModalListing, setAssignModalListing] = useState<any | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [vehicleReg, setVehicleReg] = useState("KA-01-EQ-9082");
  const [vehicleType, setVehicleType] = useState("Eco Van");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    loadNearbyListings();
  }, [category, condition, maxDistanceKm]);

  // Try auto-detecting geolocation on initial load
  useEffect(() => {
    handleDetectGPS();
  }, []);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported by browser");
      return;
    }

    setLocating(true);
    setLocationStatus("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationStatus(`GPS Active (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`);
        setLocating(false);
        // Refresh with coordinates
        loadNearbyListings(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocationStatus("Location denied or unavailable. Showing all regional listings.");
        setLocating(false);
        loadNearbyListings();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const loadNearbyListings = async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      const activeLat = lat !== undefined ? lat : latitude;
      const activeLng = lng !== undefined ? lng : longitude;

      const res = await api.getNearbyListings({
        category: category !== "ALL" ? category : undefined,
        condition: condition !== "ALL" ? condition : undefined,
        maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : undefined,
        latitude: activeLat,
        longitude: activeLng,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        search: search || undefined,
      });

      if (res.success) {
        setListings(res.data || []);
      }
    } catch (err: any) {
      console.error("Failed to load nearby listings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOpenOfferModal = (listing: any) => {
    setOfferModalListing(listing);
    setOfferedPrice(listing.expectedPrice?.toString() || "");
    setOfferMessage("Certified dealer inspection with digital payment upon doorstep collection.");
    setEstimatedPickupHours("24");
    setOfferError(null);
    setOfferSuccess(null);
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerModalListing) return;

    if (!offeredPrice || Number(offeredPrice) <= 0) {
      setOfferError("Please enter a valid offer price.");
      return;
    }

    setSubmittingOffer(true);
    setOfferError(null);

    try {
      const res = await api.makeOffer(offerModalListing.listingId, {
        offeredPrice: Number(offeredPrice),
        message: offerMessage,
        estimatedPickupHours: Number(estimatedPickupHours) || 24,
      });

      if (res.success) {
        setOfferSuccess("Offer submitted to customer! You will be notified when the customer accepts.");
        loadNearbyListings();
        setTimeout(() => setOfferModalListing(null), 1200);
      }
    } catch (err: any) {
      setOfferError(err.message || "Failed to submit offer.");
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleOpenAssignModal = async (listing: any) => {
    setAssignModalListing(listing);
    setAssignError(null);
    try {
      const res = await api.getDrivers();
      if (res.success) {
        setAvailableDrivers(res.drivers || []);
        if (res.drivers?.length > 0) {
          setSelectedDriverId(res.drivers[0].id || res.drivers[0]._id);
        }
      }
    } catch (err) {
      console.error("Failed to load drivers:", err);
    }
  };

  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalListing || !selectedDriverId) return;

    setSubmittingAssign(true);
    setAssignError(null);

    try {
      const res = await api.assignPickupDriver(assignModalListing.listingId, {
        driverId: selectedDriverId,
        vehicleRegistration: vehicleReg,
        vehicleType,
        notes: dispatchNotes,
      });

      if (res.success) {
        alert("Driver assigned and pickup scheduled! The driver will be dispatched to the customer's doorstep.");
        setAssignModalListing(null);
        loadNearbyListings();
      }
    } catch (err: any) {
      setAssignError(err.message || "Failed to assign driver.");
    } finally {
      setSubmittingAssign(false);
    }
  };

  return (
    <div id="nearby-listings-section" className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] mb-2">
            <Compass className="w-3.5 h-3.5" />
            MongoDB 2dsphere Proximity Radar
          </span>
          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Nearby Customer Electronic Listings</h2>
          <p className="text-xs text-[#6B7C74] mt-0.5 max-w-xl">
            Locate customer devices available for circular collection. Review device condition, propose buy offers, and dispatch drivers upon offer acceptance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDetectGPS}
            disabled={locating}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#D7E5DB] hover:bg-[#E5F5EA] text-[#075B46] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <MapPin className={`w-3.5 h-3.5 ${locating ? "animate-bounce" : ""}`} />
            <span>{locating ? "Detecting..." : "Update My GPS"}</span>
          </button>

          <button
            onClick={() => setShowRegionalMap(!showRegionalMap)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              showRegionalMap
                ? "bg-[#E5F5EA] text-[#075B46] border-[#087F5B]/30"
                : "bg-white text-[#173C32] border-[#D7E5DB] hover:bg-[#EDF7EF]"
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-[#075B46]" />
            <span>{showRegionalMap ? "Hide Map" : "Google Map"}</span>
          </button>

          <button
            onClick={() => loadNearbyListings()}
            className="p-2 rounded-xl bg-white border border-[#D7E5DB] text-[#173C32] hover:bg-[#EDF7EF]"
            title="Refresh listings"
          >
            <RefreshCw className="w-4 h-4 text-[#075B46]" />
          </button>
        </div>
      </div>

      {/* Regional Google Map */}
      {showRegionalMap && (
        <div className="bg-white rounded-2xl border border-[#D7E5DB] p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-[#D7E5DB]">
            <span className="font-bold text-[#173C32]">Regional Pickup & Depot Map</span>
            <span className="text-[11px] text-[#6B7C74]">Google Maps & Routes API View</span>
          </div>
          <GoogleTrackingMap
            driverLocation={latitude && longitude ? { lat: latitude, lng: longitude } : { lat: 12.9716, lng: 77.5946 }}
            driverName="Dealer Depot (Your Location)"
            customerLocation={
              listings.length > 0 && listings[0].pickupCoordinates?.coordinates
                ? {
                    lat: listings[0].pickupCoordinates.coordinates[1],
                    lng: listings[0].pickupCoordinates.coordinates[0],
                    address: listings[0].pickupAddress || listings[0].approximateLocation,
                  }
                : { lat: 12.9352, lng: 77.6245, address: "Regional Pickup Hub" }
            }
            customerName={listings.length > 0 ? listings[0].title : "Regional Listings"}
            height="280px"
          />
        </div>
      )}

      {/* Geolocation Status Notice */}
      <div className="flex items-center justify-between text-xs text-[#6B7C74] px-1">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${latitude ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span>Status: {locationStatus}</span>
        </span>
        <span className="text-[11px] text-[#075B46]">Privacy Guaranteed: Exact customer addresses masked until offer accepted.</span>
      </div>

      {/* Filters & Proximity Slider */}
      <div className="bg-white rounded-2xl border border-[#D7E5DB] p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[#6B7C74] mb-1 font-semibold">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#D7E5DB] bg-white text-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="Laptops & Computers">Laptops & Computers</option>
              <option value="Smartphones & Tablets">Smartphones & Tablets</option>
              <option value="Monitors & Displays">Monitors & Displays</option>
              <option value="Audio & Accessories">Audio & Accessories</option>
              <option value="Consumer Electronics">Consumer Electronics</option>
            </select>
          </div>

          <div>
            <label className="block text-[#6B7C74] mb-1 font-semibold">Working Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#D7E5DB] bg-white text-xs"
            >
              <option value="ALL">All Conditions</option>
              <option value="WORKING">Working (Full Function)</option>
              <option value="PARTIALLY_WORKING">Partially Working</option>
              <option value="DAMAGED">Damaged Screen / Parts</option>
              <option value="NOT_WORKING">Not Working (Scrap/Parts)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#6B7C74] mb-1 font-semibold">Max Proximity Distance</label>
            <select
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#D7E5DB] bg-white text-xs"
            >
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
              <option value="100">Within 100 km</option>
            </select>
          </div>

          <div>
            <label className="block text-[#6B7C74] mb-1 font-semibold">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7C74] absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Brand, model, etc."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadNearbyListings()}
                className="w-full pl-8 pr-2 py-1.5 rounded-xl border border-[#D7E5DB] text-xs focus:outline-none focus:border-[#075B46]"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => loadNearbyListings()}
              className="w-full py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* LISTINGS CARDS */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#6B7C74]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#075B46] mb-2" />
          Scanning for nearby electronics listings...
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D7E5DB] p-10 text-center space-y-3">
          <MapPin className="w-8 h-8 text-[#6B7C74] mx-auto" />
          <h4 className="text-sm font-serif text-[#173C32]">No listings found within current radius</h4>
          <p className="text-xs text-[#6B7C74] max-w-sm mx-auto">
            Try expanding your distance filter to 50 km or 100 km, or adjust category and condition parameters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((item) => {
            const hasMyOffer = Boolean(item.myOffer);
            const isOfferAccepted =
              item.status === "OFFER_ACCEPTED" && item.assignedDealerId;
            const canAssignDriver = isOfferAccepted && !item.pickupTaskId;

            return (
              <div
                key={item.listingId}
                className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm hover:border-[#087F5B]/50 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#075B46]">{item.listingId}</span>
                    {item.distanceKm !== null && item.distanceKm !== undefined ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#075B46] bg-[#E5F5EA] px-2 py-0.5 rounded-full border border-[#D7E5DB]">
                        <MapPin className="w-3 h-3" />
                        {item.distanceKm} km away
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#6B7C74]">Regional</span>
                    )}
                  </div>

                  {item.images && item.images.length > 0 && (
                    <div className="w-full h-36 rounded-xl overflow-hidden bg-[#F7FBF7] border border-[#D7E5DB]">
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => ((e.target as any).style.display = "none")}
                      />
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-[#173C32] line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-[#6B7C74]">
                      {item.brand} • Model {item.model} • Age: {item.ageYears} yrs
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {item.category}
                    </Badge>
                    <Badge
                      variant={item.condition === "WORKING" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {item.condition}
                    </Badge>
                  </div>

                  {item.description && (
                    <p className="text-xs text-[#6B7C74] line-clamp-2 bg-[#F7FBF7] p-2 rounded-lg border border-[#D7E5DB]">
                      "{item.description}"
                    </p>
                  )}

                  <div className="text-xs text-[#6B7C74] space-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#075B46] shrink-0" />
                      <span className="truncate">Area: {item.approximateLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#075B46] shrink-0" />
                      <span>Preferred: {item.preferredPickupDate} ({item.preferredPickupTimeSlot})</span>
                    </div>
                  </div>

                  {/* UNMASKED ADDRESS & PICKUP MAP (Only if this dealer's offer is accepted) */}
                  {item.pickupAddress && (
                    <div className="p-2.5 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-[#075B46] flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Doorstep Pickup Address (Customer Unmasked):</span>
                        </p>
                        <button
                          onClick={() =>
                            setExpandedMapListingId(
                              expandedMapListingId === item.listingId ? null : item.listingId
                            )
                          }
                          className="px-2 py-0.5 rounded-lg bg-white border border-[#087F5B]/30 text-[#075B46] font-semibold text-[10px] hover:bg-[#EDF7EF] flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>{expandedMapListingId === item.listingId ? "Hide Map" : "Google Map & Route"}</span>
                        </button>
                      </div>

                      <p className="text-[#173C32] font-medium">{item.pickupAddress}</p>
                      {item.customerPhone && (
                        <p className="text-[#075B46] font-mono text-[11px]">Phone: {item.customerPhone}</p>
                      )}

                      {/* Map for this unmasked pickup */}
                      {expandedMapListingId === item.listingId && (
                        <div className="pt-2">
                          <GoogleTrackingMap
                            taskId={item.pickupTaskId}
                            driverName="Dealer Depot"
                            customerName={item.customerName || item.title}
                            driverLocation={latitude && longitude ? { lat: latitude, lng: longitude } : { lat: 12.9716, lng: 77.5946 }}
                            customerLocation={
                              item.pickupCoordinates?.coordinates && item.pickupCoordinates.coordinates.length === 2
                                ? {
                                    lat: item.pickupCoordinates.coordinates[1],
                                    lng: item.pickupCoordinates.coordinates[0],
                                    address: item.pickupAddress,
                                  }
                                : { address: item.pickupAddress }
                            }
                            height="240px"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#D7E5DB] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#6B7C74] block">Customer Asking</span>
                    <span className="text-base font-bold text-[#075B46]">₹{item.expectedPrice.toLocaleString()}</span>
                  </div>

                  <div>
                    {canAssignDriver ? (
                      <button
                        onClick={() => handleOpenAssignModal(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch Driver</span>
                      </button>
                    ) : item.pickupTaskId ? (
                      <Badge variant="primary" className="text-[10px]">
                        Driver Dispatched
                      </Badge>
                    ) : hasMyOffer ? (
                      <div className="text-right">
                        <span className="text-[10px] text-[#6B7C74] block">Your Proposed Offer</span>
                        <span className="text-xs font-bold text-[#075B46]">
                          ₹{item.myOffer.offeredPrice.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleOpenOfferModal(item)}
                          className="text-[10px] text-[#087F5B] hover:underline block font-semibold"
                        >
                          Update Bid
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenOfferModal(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Make Buy Offer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MAKE OFFER MODAL */}
      {offerModalListing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">{offerModalListing.listingId}</span>
                <h3 className="text-base font-serif text-[#173C32]">Submit Dealer Buy Offer</h3>
              </div>
              <button
                onClick={() => setOfferModalListing(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#6B7C74]">
              Item: <strong>{offerModalListing.title}</strong> ({offerModalListing.condition})
              <br />
              Customer Asking: <strong className="text-[#075B46]">₹{offerModalListing.expectedPrice.toLocaleString()}</strong>
            </p>

            {offerError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {offerError}
              </div>
            )}
            {offerSuccess && (
              <div className="p-3 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46]">
                {offerSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitOffer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Proposed Buying Price (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={offeredPrice}
                  onChange={(e) => setOfferedPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Estimated Pickup Within (Hours)</label>
                <select
                  value={estimatedPickupHours}
                  onChange={(e) => setEstimatedPickupHours(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] bg-white text-xs"
                >
                  <option value="6">Within 6 Hours (Fast Track)</option>
                  <option value="12">Within 12 Hours</option>
                  <option value="24">Within 24 Hours</option>
                  <option value="48">Within 48 Hours</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Message to Customer</label>
                <textarea
                  rows={2}
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setOfferModalListing(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOffer}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {submittingOffer ? "Sending..." : "Submit Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN DRIVER & VEHICLE MODAL */}
      {assignModalListing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">{assignModalListing.listingId}</span>
                <h3 className="text-base font-serif text-[#173C32]">Dispatch Driver for Doorstep Pickup</h3>
              </div>
              <button
                onClick={() => setAssignModalListing(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#EDF7EF] text-xs space-y-1">
              <p className="font-bold text-[#173C32]">{assignModalListing.title}</p>
              <p className="text-[#6B7C74]">Pickup Address: {assignModalListing.pickupAddress}</p>
              <p className="text-[#075B46] font-semibold">Agreed Payout: ₹{assignModalListing.expectedPrice?.toLocaleString()}</p>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {assignError}
              </div>
            )}

            <form onSubmit={handleSubmitAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Select Driver *</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB] bg-white"
                >
                  {availableDrivers.map((d) => (
                    <option key={d.id || d._id} value={d.id || d._id}>
                      {d.fullName || d.name} ({d.phone || "No phone"}) - {d.vehicleType || "Standard"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#173C32] mb-1">Vehicle Registration *</label>
                  <input
                    type="text"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#173C32] mb-1">Vehicle Type</label>
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173C32] mb-1">Pickup Instructions for Driver</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bring antistatic packaging, verify screen power-on, collect OTP."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setAssignModalListing(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {submittingAssign ? "Dispatching..." : "Confirm & Dispatch Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
