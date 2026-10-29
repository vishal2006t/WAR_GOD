import React, { useState, useEffect, useRef } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Truck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  Navigation,
  Compass,
  Camera,
  RefreshCw,
  KeyRound,
  Scale,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { GoogleTrackingMap } from "../maps/GoogleTrackingMap";

export const DriverCustomerPickupsSection: React.FC = () => {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Live GPS Tracking & Interactive Map State
  const [activeTrackingTaskId, setActiveTrackingTaskId] = useState<string | null>(null);
  const [expandedMapTaskId, setExpandedMapTaskId] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<string>("Inactive");
  const watchIdRef = useRef<number | null>(null);

  // Handover OTP Modal State
  const [otpModalTask, setOtpModalTask] = useState<any | null>(null);
  const [inputOtp, setInputOtp] = useState("");
  const [collectionWeight, setCollectionWeight] = useState("");
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPickups();
    return () => {
      stopGpsWatch();
    };
  }, []);

  const loadPickups = async () => {
    setLoading(true);
    try {
      const res = await api.getMyPickupTasks();
      if (res.success) {
        setPickups(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load driver pickups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTripStatus = async (taskId: string, newStatus: string, note?: string) => {
    try {
      const res = await api.updatePickupTaskStatus(taskId, {
        status: newStatus,
        note: note || `Driver updated status to ${newStatus}`,
      });
      if (res.success) {
        loadPickups();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update trip status");
    }
  };

  // Toggle Live GPS tracking
  const toggleGpsTracking = (taskId: string) => {
    if (activeTrackingTaskId === taskId) {
      stopGpsWatch();
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    stopGpsWatch();
    setActiveTrackingTaskId(taskId);
    setExpandedMapTaskId(taskId);
    setTrackingStatus("Acquiring GPS fix...");

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setTrackingStatus(`Tracking Active (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);

        try {
          await api.updatePickupLocation(taskId, {
            latitude,
            longitude,
            heading: heading || 0,
            speed: speed || 0,
            accuracy: accuracy || 10,
          });
        } catch (err) {
          console.warn("Failed to stream location to server:", err);
        }
      },
      (err) => {
        setTrackingStatus(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    watchIdRef.current = id;
  };

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setActiveTrackingTaskId(null);
    setTrackingStatus("Inactive");
  };

  const handleProofPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingProof(true);
    setOtpError(null);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const res = await api.uploadEvidence(files[i]);
        if (res.success && res.file?.url) {
          newUrls.push(res.file.url);
        }
      }
      setProofPhotos((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      setOtpError(err.message || "Failed to upload proof photo");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleVerifyOtpAndCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalTask) return;

    if (!inputOtp || inputOtp.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit customer confirmation OTP.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await api.updatePickupTaskStatus(otpModalTask.taskId, {
        status: "COLLECTED",
        handoverOtp: inputOtp.trim(),
        actualWeightKg: collectionWeight ? Number(collectionWeight) : undefined,
        proofPhotos,
        note: "Doorstep collection verified with customer OTP and scale weight",
      });

      if (res.success) {
        setOtpSuccess("Handover OTP verified successfully! Pickup marked as COLLECTED.");
        // Stop tracking if this task was active
        if (activeTrackingTaskId === otpModalTask.taskId) {
          stopGpsWatch();
        }
        setTimeout(() => {
          setOtpModalTask(null);
          setInputOtp("");
          setCollectionWeight("");
          setProofPhotos([]);
          loadPickups();
        }, 1200);
      }
    } catch (err: any) {
      setOtpError(err.message || "Invalid OTP confirmation. Check with customer.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div id="driver-pickups-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] mb-2">
            <Truck className="w-3.5 h-3.5" />
            Doorstep Electronic Collections
          </span>
          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Assigned Customer Pickups</h2>
          <p className="text-xs text-[#6B7C74] mt-0.5 max-w-xl">
            Collect old electronics from customers. Stream live coordinates, verify the customer's 6-digit Handover OTP, and record collection weight.
          </p>
        </div>

        <button
          onClick={loadPickups}
          className="p-2.5 rounded-xl border border-[#D7E5DB] bg-white text-[#173C32] hover:bg-[#EDF7EF] self-start sm:self-auto"
          title="Refresh assignments"
        >
          <RefreshCw className="w-4 h-4 text-[#075B46]" />
        </button>
      </div>

      {/* GPS Status Indicator */}
      <div className="p-3 rounded-xl bg-white border border-[#D7E5DB] flex items-center justify-between text-xs text-[#6B7C74]">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              activeTrackingTaskId ? "bg-emerald-500 animate-ping" : "bg-gray-400"
            }`}
          />
          <span className="font-semibold text-[#173C32]">Live Driver GPS Stream:</span>
          <span>{trackingStatus}</span>
        </div>
        {activeTrackingTaskId && (
          <button
            onClick={stopGpsWatch}
            className="text-[11px] text-red-600 hover:underline font-semibold"
          >
            Stop Sharing GPS
          </button>
        )}
      </div>

      {/* PICKUPS LIST */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#6B7C74]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#075B46] mb-2" />
          Loading assigned pickup tasks...
        </div>
      ) : pickups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74]">
          No customer pickups currently assigned to your driver account.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pickups.map((task) => {
            const isTrackingThis = activeTrackingTaskId === task.taskId;
            const isDone = ["COLLECTED", "DELIVERED", "CANCELLED"].includes(task.status);

            return (
              <div
                key={task.taskId}
                className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm space-y-4 hover:border-[#087F5B]/50 transition-all"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#075B46]">{task.taskId}</span>
                    <h4 className="text-sm font-bold text-[#173C32]">{task.productTitle}</h4>
                    <p className="text-xs text-[#6B7C74]">Dealer: {task.dealerName}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-[#075B46]">₹{task.agreedPrice.toLocaleString()}</span>
                    <div>
                      <Badge
                        variant={
                          task.status === "COLLECTED"
                            ? "success"
                            : task.status === "EN_ROUTE"
                            ? "primary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#173C32]">Customer: {task.customerName}</span>
                    {task.customerPhone && (
                      <a
                        href={`tel:${task.customerPhone}`}
                        className="text-[#075B46] font-semibold flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{task.customerPhone}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 text-[#6B7C74]">
                    <MapPin className="w-3.5 h-3.5 text-[#075B46] shrink-0 mt-0.5" />
                    <span>{task.pickupAddress}</span>
                  </div>

                  {task.notes && (
                    <p className="text-[11px] text-[#6B7C74] italic">Note: "{task.notes}"</p>
                  )}
                </div>

                {/* TRIP LIFECYCLE ACTION BUTTONS */}
                {!isDone ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {task.status === "ASSIGNED" && (
                        <button
                          onClick={() => handleUpdateTripStatus(task.taskId, "ACCEPTED")}
                          className="px-3 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm"
                        >
                          Accept Assignment
                        </button>
                      )}

                      {task.status === "ACCEPTED" && (
                        <button
                          onClick={() => handleUpdateTripStatus(task.taskId, "EN_ROUTE")}
                          className="px-3.5 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Start Trip (En Route)</span>
                        </button>
                      )}

                      {task.status === "EN_ROUTE" && (
                        <button
                          onClick={() => handleUpdateTripStatus(task.taskId, "ARRIVED")}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                        >
                          Mark Arrived at Doorstep
                        </button>
                      )}

                      {["EN_ROUTE", "ARRIVED"].includes(task.status) && (
                        <button
                          onClick={() => {
                            setOtpModalTask(task);
                            setInputOtp("");
                            setCollectionWeight("");
                            setProofPhotos([]);
                            setOtpError(null);
                            setOtpSuccess(null);
                          }}
                          className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Verify Handover OTP</span>
                        </button>
                      )}
                    </div>

                    {/* GPS STREAM CONTROLLER & MAP TOGGLE */}
                    <div className="pt-2 border-t border-[#D7E5DB] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleGpsTracking(task.taskId)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                            isTrackingThis
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-white text-[#6B7C74] border-[#D7E5DB] hover:bg-[#EDF7EF]"
                          }`}
                        >
                          <Compass className={`w-3.5 h-3.5 ${isTrackingThis ? "animate-spin text-emerald-700" : ""}`} />
                          <span>{isTrackingThis ? "Streaming GPS..." : "Share Live Location"}</span>
                        </button>

                        <button
                          onClick={() => setExpandedMapTaskId(expandedMapTaskId === task.taskId ? null : task.taskId)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                            expandedMapTaskId === task.taskId
                              ? "bg-[#E5F5EA] text-[#075B46] border-[#087F5B]/30"
                              : "bg-white text-[#6B7C74] border-[#D7E5DB] hover:bg-[#EDF7EF]"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#075B46]" />
                          <span>{expandedMapTaskId === task.taskId ? "Hide Route Map" : "View Route Map"}</span>
                        </button>
                      </div>

                      {task.distanceKm && (
                        <span className="text-[11px] text-[#075B46] font-semibold">
                          Distance: {task.distanceKm} km (ETA: ~{task.etaMinutes} mins)
                        </span>
                      )}
                    </div>

                    {/* INTERACTIVE GOOGLE MAPS & ROUTES API V2 */}
                    {(expandedMapTaskId === task.taskId || isTrackingThis) && (
                      <div className="pt-2">
                        <GoogleTrackingMap
                          taskId={task.taskId}
                          driverName={task.driverName || "Carrier Van (You)"}
                          customerName={task.customerName}
                          driverLocation={
                            isTrackingThis && currentCoords
                              ? currentCoords
                              : task.lastKnownLocation
                              ? { lat: task.lastKnownLocation.latitude, lng: task.lastKnownLocation.longitude }
                              : currentCoords || { lat: 12.9716, lng: 77.5946 }
                          }
                          customerLocation={
                            task.pickupCoordinates?.coordinates && task.pickupCoordinates.coordinates.length === 2
                              ? {
                                  lat: task.pickupCoordinates.coordinates[1],
                                  lng: task.pickupCoordinates.coordinates[0],
                                  address: task.pickupAddress,
                                }
                              : { address: task.pickupAddress }
                          }
                          height="270px"
                          onRouteComputed={(info) => {
                            task.distanceKm = info.distanceKm;
                            task.etaMinutes = info.durationMinutes;
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46] flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Collection Complete & Handover Verified</span>
                      </span>
                      {task.actualWeightKg && (
                        <span className="font-mono text-xs font-bold">{task.actualWeightKg} kg</span>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setExpandedMapTaskId(expandedMapTaskId === task.taskId ? null : task.taskId)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                          expandedMapTaskId === task.taskId
                            ? "bg-[#E5F5EA] text-[#075B46] border-[#087F5B]/30"
                            : "bg-white text-[#6B7C74] border-[#D7E5DB] hover:bg-[#EDF7EF]"
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#075B46]" />
                        <span>{expandedMapTaskId === task.taskId ? "Hide Route Map" : "View Route Map"}</span>
                      </button>
                    </div>

                    {expandedMapTaskId === task.taskId && (
                      <div className="pt-1">
                        <GoogleTrackingMap
                          taskId={task.taskId}
                          driverName={task.driverName || "Carrier Van"}
                          customerName={task.customerName}
                          customerLocation={
                            task.pickupCoordinates?.coordinates && task.pickupCoordinates.coordinates.length === 2
                              ? {
                                  lat: task.pickupCoordinates.coordinates[1],
                                  lng: task.pickupCoordinates.coordinates[0],
                                  address: task.pickupAddress,
                                }
                              : { address: task.pickupAddress }
                          }
                          height="240px"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* HANDOVER OTP CONFIRMATION MODAL */}
      {otpModalTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">{otpModalTask.taskId}</span>
                <h3 className="text-base font-serif text-[#173C32]">Handover Confirmation OTP</h3>
              </div>
              <button
                onClick={() => setOtpModalTask(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#6B7C74]">
              Ask the customer <strong>{otpModalTask.customerName}</strong> for their 6-digit confirmation OTP displayed on their screen.
            </p>

            {otpError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {otpError}
              </div>
            )}
            {otpSuccess && (
              <div className="p-3 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46]">
                {otpSuccess}
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndCollect} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">
                  Customer 6-Digit Handover OTP *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 730719"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  className="w-full px-4 py-2 text-center font-mono text-xl tracking-widest rounded-xl border border-[#D7E5DB] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Scale Weight at Collection (kg)</label>
                <input
                  type="number"
                  step="0.05"
                  placeholder="e.g. 2.25"
                  value={collectionWeight}
                  onChange={(e) => setCollectionWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Collection Proof Photo</label>
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 rounded-xl border border-[#D7E5DB] hover:bg-[#EDF7EF] cursor-pointer flex items-center gap-1.5 font-semibold text-[#173C32]">
                    <Camera className="w-4 h-4 text-[#075B46]" />
                    <span>Upload Proof</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofPhotoUpload}
                      disabled={uploadingProof}
                      className="hidden"
                    />
                  </label>
                  {uploadingProof && <span className="text-[#075B46]">Uploading photo...</span>}
                  {proofPhotos.length > 0 && (
                    <span className="text-[#075B46] font-semibold">✓ {proofPhotos.length} photo attached</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setOtpModalTask(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm transition-all"
                >
                  {verifyingOtp ? "Verifying..." : "Verify OTP & Complete Pickup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
