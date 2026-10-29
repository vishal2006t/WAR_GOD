import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Search,
  Filter,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  X,
  Truck,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Clock,
  ArrowRight,
  Package,
  Laptop,
  Check,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Info,
  Shield,
  Tag,
  Battery,
  Wrench,
  FileText,
  Lock,
  Flame,
  CheckSquare,
} from "lucide-react";

interface CustomerMarketplaceSectionProps {
  initialTab?: "browse" | "orders";
  defaultSearch?: string;
  onSelectProductForHistory?: (productId: string) => void;
}

export const CustomerMarketplaceSection: React.FC<CustomerMarketplaceSectionProps> = ({
  initialTab = "browse",
  defaultSearch = "",
  onSelectProductForHistory,
}) => {
  const [subTab, setSubTab] = useState<"browse" | "orders">(initialTab);
  const [search, setSearch] = useState(defaultSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [conditionGrade, setConditionGrade] = useState("ALL");
  const [productSource, setProductSource] = useState<"ALL" | "REFURBISHED" | "P2P">("ALL");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Orders State
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Product Details Modal State
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"overview" | "history" | "comparison">("overview");

  // Checkout Modal State
  const [checkoutItem, setCheckoutItem] = useState<{
    itemType: "REFURBISHED_PRODUCT" | "P2P_PRODUCT";
    item: any;
  } | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [shippingFullName, setShippingFullName] = useState("Vishal Sharma");
  const [shippingPhone, setShippingPhone] = useState("+91 98765 43210");
  const [shippingStreet, setShippingStreet] = useState("104, Green Heights, 12th Main Road");
  const [shippingCity, setShippingCity] = useState("Bengaluru");
  const [shippingState, setShippingState] = useState("Karnataka");
  const [shippingPincode, setShippingPincode] = useState("560038");
  const [paymentMethod, setPaymentMethod] = useState<"TEST_UPI" | "TEST_CARD" | "TEST_NETBANKING" | "COD">("TEST_UPI");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  const categories = [
    "ALL",
    "Laptops & Computers",
    "Smartphones & Tablets",
    "Monitors & Displays",
    "Audio & Accessories",
    "Consumer Electronics",
  ];

  const popularBrands = ["ALL", "Apple", "Dell", "Lenovo", "HP", "Samsung", "Asus"];

  const conditionOptions = [
    { label: "All Conditions", value: "ALL" },
    { label: "Pristine / Mint (A)", value: "A_MINT" },
    { label: "Very Good (B)", value: "B_VERY_GOOD" },
    { label: "Good (C)", value: "C_GOOD" },
    { label: "Fair / Working", value: "WORKING" },
  ];

  useEffect(() => {
    loadBrowseData();
  }, [selectedCategory, selectedBrand, conditionGrade, inStockOnly, productSource]);

  useEffect(() => {
    if (subTab === "orders") {
      loadMyOrders();
    }
  }, [subTab]);

  const loadBrowseData = async () => {
    setLoading(true);
    try {
      const res = await api.browseMarketplace({
        type: productSource === "ALL" ? "ALL" : productSource === "REFURBISHED" ? "REFURBISHED" : "P2P",
        category: selectedCategory !== "ALL" ? selectedCategory : undefined,
        brand: selectedBrand !== "ALL" ? selectedBrand : undefined,
        conditionGrade: conditionGrade !== "ALL" ? conditionGrade : undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        search: search.trim() ? search.trim() : undefined,
        inStockOnly: inStockOnly,
      });

      if (res.success && res.data) {
        // Prefer unified allProducts; fallback to combined or refurbished
        const list = res.data.allProducts || [...(res.data.refurbished || []), ...(res.data.p2pListings || [])];
        setProducts(list);
      }
    } catch (err: any) {
      console.error("Failed to browse marketplace:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.getMyOrders();
      if (res.success) {
        setMyOrders(res.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch my orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Open Full Product Details Modal & fetch full inspection + provenance timeline
  const handleOpenDetails = async (item: any) => {
    setDetailsLoading(true);
    setSelectedProduct(item); // fast initial show
    setActiveDetailsTab("overview");

    try {
      const res = await api.getMarketplaceProduct(item.resaleId || item.id);
      if (res.success && res.product) {
        setSelectedProduct(res.product);
      }
    } catch (err) {
      console.error("Failed to load rich product details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenCheckout = (item: any) => {
    if (!item.stock || item.stock <= 0) return;
    const itemType = item.itemType === "P2P_PRODUCT" ? "P2P_PRODUCT" : "REFURBISHED_PRODUCT";
    setCheckoutItem({ itemType, item });
    setOrderQuantity(1);
    setOrderError(null);
    setConfirmedOrder(null);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutItem) return;

    if (!shippingStreet || !shippingCity || !shippingPincode) {
      setOrderError("Please provide a complete shipping street address, city, and PIN code.");
      return;
    }

    setSubmittingOrder(true);
    setOrderError(null);

    try {
      const itemId = checkoutItem.item.resaleId || checkoutItem.item.id;

      // 1. Create order on backend (atomically reserves stock and validates inventory)
      const orderRes = await api.createMarketplaceOrder({
        itemType: checkoutItem.itemType,
        itemId,
        quantity: orderQuantity,
        shippingAddress: {
          fullName: shippingFullName || "Authorized Customer",
          phone: shippingPhone || "+91 98765 43210",
          streetAddress: shippingStreet,
          city: shippingCity,
          state: shippingState,
          pincode: shippingPincode,
        },
        paymentMethod,
      });

      if (!orderRes.success) {
        throw new Error(orderRes.error || "Failed to place order");
      }

      const order = orderRes.data;

      // 2. Server-side payment verification (Demo / Test mode)
      const payRes = await api.payTestOrder(order.orderId, { paymentMethod });
      if (payRes.success) {
        setConfirmedOrder(payRes.data);
        loadBrowseData();
      } else {
        setConfirmedOrder(order);
      }
    } catch (err: any) {
      setOrderError(err.message || "Checkout failed. Please try again.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const formatConditionGrade = (grade?: string) => {
    switch (grade) {
      case "A_MINT":
        return "Mint / Like New (A+)";
      case "B_VERY_GOOD":
        return "Very Good (B)";
      case "C_GOOD":
        return "Good Condition (C)";
      case "WORKING":
        return "Functional Working";
      default:
        return grade || "Inspected";
    }
  };

  const functionalTestsLabels: { [k: string]: string } = {
    powerOn: "Power On & Boot Diagnostic",
    displayWorks: "Display Panel & Pixel Integrity",
    touchOrKeysWork: "Keyboard & Trackpad / Touchscreen",
    batteryCharges: "Battery Health & Charge Controller",
    connectivityWorks: "WiFi & Bluetooth Connectivity",
    audioPortsWork: "Audio Output & Hardware I/O Ports",
  };

  return (
    <div id="customer-marketplace-section" className="space-y-6">
      {/* Top Banner: Circular Second-Hand & Refurbished Electronics */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]">
              <Sparkles className="w-3.5 h-3.5" />
              Circular Marketplace
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white text-[#173C32] border border-[#D7E5DB]">
              <ShieldCheck className="w-3 h-3 text-[#087F5B]" />
              Verified Hardware Provenance
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Pre-Owned & Certified Refurbished Electronics</h2>
          <p className="text-xs text-[#6B7C74] mt-1 max-w-2xl font-sans">
            Browse verified second-hand devices from peer owners and certified refurbishers. Complete technical inspection records, repair history, and ownership timelines are displayed for every device.
          </p>
        </div>

        {/* Sub-Tabs: Browse vs My Orders */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-[#D7E5DB] shadow-xs self-stretch sm:self-auto">
          <button
            onClick={() => setSubTab("browse")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              subTab === "browse"
                ? "bg-[#075B46] text-white shadow-xs"
                : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#EDF7EF]"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Browse Electronics</span>
          </button>
          <button
            onClick={() => setSubTab("orders")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              subTab === "orders"
                ? "bg-[#075B46] text-white shadow-xs"
                : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#EDF7EF]"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>My Purchases ({myOrders.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: BROWSE & SEARCH ELECTRONICS */}
      {/* ===================================================================== */}
      {subTab === "browse" && (
        <div className="space-y-6">
          {/* SEARCH & COMPREHENSIVE FILTERS BAR */}
          <div className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-xs space-y-4">
            {/* Search Input */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  id="marketplace-search-input"
                  type="text"
                  placeholder="Search laptops, smartphones, MacBook, Dell, Apple, processors, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadBrowseData()}
                  className="w-full bg-[#F7FBF7] border border-[#D7E5DB] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="marketplace-search-btn"
                  onClick={loadBrowseData}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("ALL");
                    setSelectedBrand("ALL");
                    setConditionGrade("ALL");
                    setProductSource("ALL");
                    setInStockOnly(false);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="px-3 py-2.5 rounded-xl border border-[#D7E5DB] text-xs text-[#6B7C74] hover:bg-[#EDF7EF] transition-all"
                  title="Reset Filters"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Source & Availability Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D7E5DB]">
              {/* Product Source Filter */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[#6B7C74] font-semibold text-[11px] mr-1">Source:</span>
                {[
                  { id: "ALL", label: "All Second-Hand" },
                  { id: "REFURBISHED", label: "Certified Refurbished" },
                  { id: "P2P", label: "Customer Peer-to-Peer" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setProductSource(s.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      productSource === s.id
                        ? "bg-[#075B46] text-white"
                        : "bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* In-Stock Filter Toggle */}
              <label
                id="filter-in-stock-only"
                className="flex items-center gap-2 cursor-pointer text-xs text-[#173C32] font-semibold bg-[#EDF7EF] px-3 py-1.5 rounded-xl border border-[#D7E5DB]"
              >
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded text-[#075B46] focus:ring-[#075B46]"
                />
                <span>In-Stock Only</span>
              </label>
            </div>

            {/* Category & Brand Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#F7FBF7] border border-[#D7E5DB] rounded-lg px-2.5 py-1.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === "ALL" ? "All Categories" : c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full bg-[#F7FBF7] border border-[#D7E5DB] rounded-lg px-2.5 py-1.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                >
                  {popularBrands.map((b) => (
                    <option key={b} value={b}>
                      {b === "ALL" ? "All Brands" : b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Condition Grade</label>
                <select
                  value={conditionGrade}
                  onChange={(e) => setConditionGrade(e.target.value)}
                  className="w-full bg-[#F7FBF7] border border-[#D7E5DB] rounded-lg px-2.5 py-1.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                >
                  {conditionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7C74] mb-1">Price Range (₹)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-1/2 bg-[#F7FBF7] border border-[#D7E5DB] rounded-lg px-2 py-1.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                  />
                  <span className="text-[#6B7C74] text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-1/2 bg-[#F7FBF7] border border-[#D7E5DB] rounded-lg px-2 py-1.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PRODUCTS LISTING / GRID */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif text-[#173C32]">Verified Second-Hand & Refurbished Devices</h3>
                <span className="text-xs text-[#6B7C74]">Showing {products.length} electronics matching criteria</span>
              </div>

              <button
                onClick={loadBrowseData}
                disabled={loading}
                className="text-xs text-[#075B46] hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Grid</span>
              </button>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-[#D7E5DB] p-12 text-center text-xs text-[#6B7C74]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#075B46] mb-2" />
                Loading verified second-hand electronics...
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#D7E5DB] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#EDF7EF] text-[#075B46] flex items-center justify-center mx-auto">
                  <Laptop className="w-6 h-6" />
                </div>
                <p className="text-sm font-serif text-[#173C32]">No electronics found matching selected filters</p>
                <p className="text-xs text-[#6B7C74] max-w-sm mx-auto">
                  Try clearing some filter criteria, broadening your price range, or searching for a different brand.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("ALL");
                    setSelectedBrand("ALL");
                    setConditionGrade("ALL");
                    setProductSource("ALL");
                    setInStockOnly(false);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#075B46] text-white text-xs font-semibold"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((item) => {
                  const isAvailable = (item.stock || 0) > 0 && item.status !== "SOLD";
                  const isP2P = item.itemType === "P2P_PRODUCT";
                  const imageSrc =
                    item.images && item.images.length > 0
                      ? item.images[0]
                      : "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80";

                  return (
                    <div
                      key={item.resaleId || item.id}
                      className="bg-white rounded-2xl border border-[#D7E5DB] overflow-hidden shadow-xs hover:shadow-md hover:border-[#087F5B]/50 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Image Header with Badges */}
                        <div className="relative h-44 bg-[#F7FBF7] overflow-hidden border-b border-[#D7E5DB]">
                          <img
                            src={imageSrc}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e: any) => {
                              e.target.src =
                                "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80";
                            }}
                          />

                          {/* Top Badges */}
                          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                                isP2P
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isP2P ? "P2P Second-Hand" : "Certified Refurbished"}
                            </span>

                            {item.isCertifiedOnChain && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E5F5EA] text-[#075B46] border border-[#087F5B]/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-[#087F5B]" />
                                <span>On-Chain Verified</span>
                              </span>
                            )}
                          </div>

                          {/* Availability Badge */}
                          <div className="absolute top-2.5 right-2.5">
                            {isAvailable ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                                In Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-white shadow-xs">
                                Sold Out
                              </span>
                            )}
                          </div>

                          {/* Approximate Location Tag */}
                          <div className="absolute bottom-2 left-2.5 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-emerald-300" />
                            <span>{item.approximateLocation || "Indiranagar, Bengaluru"}</span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-[#6B7C74]">
                              <span className="font-semibold uppercase text-[#075B46]">{item.brand}</span>
                              <span>Age: {item.ageYears != null ? `${item.ageYears} yrs` : "Inspected"}</span>
                            </div>
                            <h4 className="text-sm font-bold text-[#173C32] mt-0.5 line-clamp-1">{item.title}</h4>
                            <p className="text-[11px] text-[#6B7C74] line-clamp-1">Model: {item.model || "Standard"}</p>
                          </div>

                          {/* Specifications Pill Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-1.5 rounded-lg bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                              <span className="text-[10px] text-[#6B7C74] block">Condition</span>
                              <span className="font-semibold text-[#173C32]">
                                {formatConditionGrade(item.conditionGrade || item.condition)}
                              </span>
                            </div>

                            <div className="p-1.5 rounded-lg bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                              <span className="text-[10px] text-[#6B7C74] block">Warranty</span>
                              <span className="font-semibold text-[#075B46]">
                                {item.warrantyMonths
                                  ? `${item.warrantyMonths}m Certified`
                                  : "7-Day P2P Window"}
                              </span>
                            </div>
                          </div>

                          {/* Inspection Status & Seller Information */}
                          <div className="p-2 rounded-xl bg-[#EDF7EF] text-[11px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[#6B7C74]">Seller:</span>
                              <span className="font-semibold text-[#173C32]">
                                {isP2P ? "Owner 1 (Peer Seller)" : item.dealerName || "Certified Refurbisher"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#6B7C74]">Inspection:</span>
                              <span className="font-semibold text-[#075B46] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-[#087F5B]" />
                                <span>{item.inspectionStatus || "Verified Passed"}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Price & Actions */}
                      <div className="p-4 pt-3 border-t border-[#D7E5DB] bg-white flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-[#6B7C74] block">Price</span>
                          <span className="text-base font-bold text-[#075B46]">₹{item.price?.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(item)}
                            className="px-3 py-1.5 rounded-xl border border-[#D7E5DB] hover:bg-[#EDF7EF] text-xs text-[#173C32] font-semibold transition-all"
                          >
                            Details & Provenance
                          </button>

                          {isAvailable ? (
                            <button
                              onClick={() => handleOpenCheckout(item)}
                              className="px-3 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-xs transition-all"
                            >
                              Buy Device
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed border border-gray-200"
                            >
                              Sold Out
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MY PURCHASES & ORDER TRACKING */}
      {/* ===================================================================== */}
      {subTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-serif text-[#173C32]">Purchase History & Legal Title Certificates</h3>
              <p className="text-xs text-[#6B7C74]">
                Trace your purchased pre-owned electronics, test transaction receipts, and official ownership certificates.
              </p>
            </div>
            <button
              onClick={loadMyOrders}
              className="text-xs text-[#075B46] hover:underline flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
          </div>

          {ordersLoading ? (
            <div className="p-12 text-center text-xs text-[#6B7C74] bg-white rounded-2xl border border-[#D7E5DB]">
              Loading your order history...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74]">
              You haven't placed any marketplace orders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#D7E5DB]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#075B46]">{ord.orderId}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                          {ord.itemType}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#173C32] mt-0.5">{ord.itemTitle}</h4>
                      <p className="text-xs text-[#6B7C74]">
                        Seller: {ord.sellerName} ({ord.sellerRole}) • Ordered on:{" "}
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="text-base font-bold text-[#075B46]">₹{ord.totalAmount?.toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        {ord.paymentStatus === "VERIFIED_PAID" ? (
                          <Badge variant="success" className="text-[10px]">
                            Verified Paid • Ownership Transferred
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700">
                            Payment Pending
                          </Badge>
                        )}

                        <Badge variant="primary" className="text-[10px]">
                          {ord.orderStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7C74]">
                    <div>
                      <span>
                        Destination: {ord.shippingAddress?.fullName}, {ord.shippingAddress?.city} (
                        {ord.shippingAddress?.pincode})
                      </span>
                    </div>

                    {ord.paymentTxRef && (
                      <div className="font-mono text-[10px] text-[#075B46] bg-[#E5F5EA] px-2.5 py-1 rounded-md border border-[#D7E5DB]">
                        Verified Custody Ref: {ord.paymentTxRef}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: FULL PRODUCT DETAILS & PROVENANCE TIMELINE */}
      {/* ===================================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#075B46]">{selectedProduct.resaleId}</span>
                  <Badge variant={selectedProduct.conditionGrade === "A_MINT" ? "success" : "outline"}>
                    {formatConditionGrade(selectedProduct.conditionGrade || selectedProduct.condition)}
                  </Badge>
                  {selectedProduct.isCertifiedOnChain && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E5F5EA] text-[#075B46] border border-[#087F5B]/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#087F5B]" />
                      <span>On-Chain Verified</span>
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-serif text-[#173C32] mt-1">{selectedProduct.title}</h3>
                <p className="text-xs text-[#6B7C74]">
                  {selectedProduct.brand} {selectedProduct.model && `• Model: ${selectedProduct.model}`} • Location:{" "}
                  {selectedProduct.approximateLocation || "Indiranagar, Bengaluru"}
                </p>
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-xl hover:bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 text-xs font-semibold">
              <button
                onClick={() => setActiveDetailsTab("overview")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeDetailsTab === "overview"
                    ? "bg-[#075B46] text-white"
                    : "text-[#6B7C74] hover:bg-[#EDF7EF]"
                }`}
              >
                Inspection & Transparency Breakdown
              </button>
              <button
                onClick={() => setActiveDetailsTab("history")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeDetailsTab === "history"
                    ? "bg-[#075B46] text-white"
                    : "text-[#6B7C74] hover:bg-[#EDF7EF]"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Lifecycle & Ownership Timeline (7 Stages)</span>
              </button>
            </div>

            {/* DETAILS TAB 1: OVERVIEW & SELLER VS TECHNICIAN BREAKDOWN */}
            {activeDetailsTab === "overview" && (
              <div className="space-y-5">
                {/* Price & Primary Warranty Banner */}
                <div className="p-4 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-[#6B7C74] block">Marketplace Price</span>
                    <span className="text-2xl font-bold text-[#075B46]">₹{selectedProduct.price?.toLocaleString()}</span>
                  </div>

                  <div className="flex flex-col sm:items-end text-xs">
                    <span className="text-[#6B7C74]">Warranty & Inspection Window:</span>
                    <span className="font-bold text-[#173C32]">
                      {selectedProduct.technicianVerified?.warranty ||
                        selectedProduct.warranty ||
                        "Standard P2P 7-day inspection window"}
                    </span>
                    <span className="text-[10px] text-[#075B46] font-mono">
                      {selectedProduct.technicianVerified?.blockchainVerification ||
                        "Internal database audit verified"}
                    </span>
                  </div>
                </div>

                {/* TWO-COLUMN TRANSPARENCY COMPARISON: SELLER-REPORTED VS TECHNICIAN-VERIFIED */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* COLUMN 1: SELLER-REPORTED INFORMATION */}
                  <div className="p-4 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#D7E5DB]">
                      <User className="w-4 h-4 text-[#075B46]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#173C32]">
                        Seller-Reported Information
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Registered Seller:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.sellerLabel || "Owner 1"}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Usage Age:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.usageAge ||
                            (selectedProduct.ageYears != null ? `${selectedProduct.ageYears} years` : "Not recorded")}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Seller Condition:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.sellerCondition ||
                            selectedProduct.condition ||
                            "Not recorded"}
                        </span>
                      </div>

                      <div className="py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74] block mb-0.5">Damage Details (Visible Defects):</span>
                        <p className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.damageDetails ||
                            selectedProduct.damageDetails ||
                            "No physical defects reported by seller"}
                        </p>
                      </div>

                      <div className="py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74] block mb-0.5">Included Accessories:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.accessories
                            ? selectedProduct.sellerReported.accessories.join(", ")
                            : selectedProduct.accessories
                            ? selectedProduct.accessories.join(", ")
                            : "Device only"}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Seller Battery Assessment:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.batteryHealth || "Not recorded"}
                          {selectedProduct.sellerReported?.maxCapacityPercent
                            ? ` (${selectedProduct.sellerReported.maxCapacityPercent})`
                            : ""}
                        </span>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-[#6B7C74]">Approximate Location:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.sellerReported?.approximateLocation ||
                            selectedProduct.approximateLocation ||
                            "Indiranagar, Bengaluru"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* COLUMN 2: TECHNICIAN-VERIFIED INFORMATION */}
                  <div className="p-4 rounded-xl bg-[#EDF7EF]/70 border border-[#087F5B]/30 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#D7E5DB]">
                      <Wrench className="w-4 h-4 text-[#075B46]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#075B46]">
                        Technician-Verified Information
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Technician / Reviewer:</span>
                        <span className="font-bold text-[#075B46]">
                          {selectedProduct.technicianVerified?.technicianName ||
                            selectedProduct.inspection?.inspectorName ||
                            "Certified Hardware Specialist"}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Verified Cosmetic Grade:</span>
                        <span className="font-bold text-[#173C32]">
                          {formatConditionGrade(
                            selectedProduct.technicianVerified?.cosmeticGrade ||
                              selectedProduct.inspection?.cosmeticGrade ||
                              selectedProduct.conditionGrade
                          )}
                        </span>
                      </div>

                      <div className="py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74] block mb-0.5">Defects / Diagnostic Findings:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.technicianVerified?.defects ||
                            selectedProduct.inspection?.findings ||
                            "No operational defects found"}
                        </span>
                      </div>

                      <div className="py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74] block mb-0.5">Repairs & Servicing Performed:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.technicianVerified?.repairsPerformed ||
                            selectedProduct.inspection?.repairPerformed ||
                            selectedProduct.repairHistory ||
                            "Not recorded"}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Replaced Components:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.technicianVerified?.replacedComponents ||
                            selectedProduct.inspection?.replacedComponents ||
                            "None"}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                        <span className="text-[#6B7C74]">Verified Battery Health:</span>
                        <span className="font-semibold text-[#173C32]">
                          {selectedProduct.technicianVerified?.batteryHealth || "Not recorded"}
                          {selectedProduct.technicianVerified?.batteryCycleCount &&
                          selectedProduct.technicianVerified?.batteryCycleCount !== "Not recorded"
                            ? ` (${selectedProduct.technicianVerified.batteryCycleCount} cycles)`
                            : ""}
                        </span>
                      </div>

                      <div className="py-1">
                        <span className="text-[#6B7C74] block text-[10px]">Inspection Report Hash:</span>
                        <span className="font-mono text-[10px] text-[#075B46] break-all">
                          {selectedProduct.technicianVerified?.inspectionReportHash ||
                            selectedProduct.inspection?.inspectionReportHash ||
                            "Not recorded"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6-POINT FUNCTIONAL TESTS CHECKLIST */}
                {selectedProduct.inspection?.functionalTests && (
                  <div className="p-4 rounded-xl bg-white border border-[#D7E5DB] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#173C32]">
                      Individual Functional Diagnostic Test Results
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(functionalTestsLabels).map(([key, label]) => {
                        const passed = selectedProduct.inspection.functionalTests[key] === true;
                        return (
                          <div
                            key={key}
                            className={`p-2 rounded-lg border flex items-center justify-between ${
                              passed
                                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                                : "bg-rose-50/60 border-rose-200 text-rose-900"
                            }`}
                          >
                            <span className="font-medium">{label}</span>
                            <span className="font-bold flex items-center gap-1">
                              {passed ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>PASS</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5 text-rose-600" />
                                  <span>FAIL</span>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DETAILS TAB 2: TRACEABLE 7-STAGE PRODUCT LIFECYCLE TIMELINE */}
            {activeDetailsTab === "history" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-xs text-[#075B46]">
                  <strong>Verifiable Lifecycle Timeline: </strong>
                  Chronological record from original registration by Owner 1 through inspection, refurbishment, resale listing, purchase, and legal title transfer to Owner 2.
                </div>

                {/* Timeline Component */}
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D7E5DB]">
                  {(selectedProduct.timeline || []).map((step: any, idx: number) => {
                    const isCompleted = step.status === "COMPLETED";
                    const isPending = step.status === "PENDING";
                    const isNotRecorded = step.status === "NOT_RECORDED";

                    return (
                      <div key={idx} className="relative space-y-1">
                        {/* Dot Icon */}
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            isCompleted
                              ? "bg-[#075B46] border-white text-white shadow-xs"
                              : isPending
                              ? "bg-amber-100 border-amber-500 text-amber-800"
                              : "bg-gray-100 border-gray-400 text-gray-500"
                          }`}
                        >
                          {isCompleted ? "✓" : step.stage || idx + 1}
                        </div>

                        {/* Event Content */}
                        <div className="bg-[#F7FBF7] p-3 rounded-xl border border-[#D7E5DB] space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-[#173C32]">
                              Stage {step.stage || idx + 1}: {step.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#6B7C74]">
                              {step.timestamp ? new Date(step.timestamp).toLocaleDateString() : "Not recorded"}
                            </span>
                          </div>

                          <p className="text-xs text-[#6B7C74]">{step.description}</p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                            <span className="text-[#075B46] font-semibold">
                              Responsible Actor: {step.actor || "Authorized Participant"}
                            </span>
                            <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#D7E5DB] text-[#6B7C74]">
                              Ref: {step.evidence}
                            </span>
                          </div>

                          {step.isVerifiedOnChain && (
                            <div className="mt-1 pt-1 border-t border-[#D7E5DB] text-[10px] text-[#075B46] font-mono flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-[#087F5B]" />
                              <span>On-Chain Verified: {step.txHash}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-[#D7E5DB] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B7C74] block">Price</span>
                <span className="text-xl font-bold text-[#075B46]">₹{selectedProduct.price?.toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74] hover:bg-[#EDF7EF]"
                >
                  Close
                </button>

                {(selectedProduct.stock || 0) > 0 && selectedProduct.status !== "SOLD" ? (
                  <button
                    onClick={() => {
                      const p = selectedProduct;
                      setSelectedProduct(null);
                      handleOpenCheckout(p);
                    }}
                    className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-xs"
                  >
                    Proceed to Order
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed border border-gray-200"
                  >
                    Sold Out
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ATOMIC CHECKOUT & TEST PAYMENT CONFIRMATION */}
      {/* ===================================================================== */}
      {checkoutItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150 max-h-[92vh] overflow-y-auto">
            {!confirmedOrder ? (
              <>
                <div className="flex items-start justify-between border-b border-[#D7E5DB] pb-3">
                  <div>
                    <h3 className="text-base font-serif text-[#173C32]">Purchase & Transfer Ownership</h3>
                    <p className="text-xs text-[#6B7C74]">
                      Atomic inventory reservation and verifiable legal title handover
                    </p>
                  </div>
                  <button
                    onClick={() => setCheckoutItem(null)}
                    className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* TEST MODE TRANSPARENCY NOTICE */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Demo / Test Checkout Mode: </span>
                    <span>
                      No actual financial transactions or charges will occur. Validates stock atomically on the database, generates a cryptographic payment receipt, and transfers ownership legally to your account.
                    </span>
                  </div>
                </div>

                {orderError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {orderError}
                  </div>
                )}

                {/* Order Item Summary */}
                <div className="p-3.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#075B46] uppercase font-bold block">
                      {checkoutItem.itemType}
                    </span>
                    <h4 className="text-sm font-bold text-[#173C32]">{checkoutItem.item.title}</h4>
                    <span className="text-xs text-[#6B7C74]">Unit Price: ₹{checkoutItem.item.price?.toLocaleString()}</span>
                  </div>
                  <span className="text-lg font-bold text-[#075B46]">
                    ₹{(checkoutItem.item.price * orderQuantity).toLocaleString()}
                  </span>
                </div>

                {/* Checkout Form */}
                <form onSubmit={handleCheckoutSubmit} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#173C32] mb-1">Buyer Full Name</label>
                      <input
                        type="text"
                        value={shippingFullName}
                        onChange={(e) => setShippingFullName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#173C32] mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        value={shippingPhone}
                        onChange={(e) => setShippingPhone(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#173C32] mb-1">Street Address</label>
                    <input
                      type="text"
                      value={shippingStreet}
                      onChange={(e) => setShippingStreet(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#173C32] mb-1">City</label>
                      <input
                        type="text"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        required
                        className="w-full px-2.5 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#173C32] mb-1">State</label>
                      <input
                        type="text"
                        value={shippingState}
                        onChange={(e) => setShippingState(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#173C32] mb-1">PIN Code</label>
                      <input
                        type="text"
                        value={shippingPincode}
                        onChange={(e) => setShippingPincode(e.target.value)}
                        required
                        className="w-full px-2.5 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#173C32] mb-1">
                      Payment Simulation Method (Test Mode)
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white focus:outline-none focus:border-[#075B46]"
                    >
                      <option value="TEST_UPI">Test UPI (Simulated Instant Settlement)</option>
                      <option value="TEST_CARD">Test Card / Debit</option>
                      <option value="TEST_NETBANKING">Test Net Banking</option>
                      <option value="COD">Cash on Delivery (Pending Payment)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D7E5DB]">
                    <button
                      type="button"
                      onClick={() => setCheckoutItem(null)}
                      className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingOrder}
                      className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-xs flex items-center gap-2"
                    >
                      {submittingOrder && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm Test Purchase</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* ORDER CONFIRMED VIEW */
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-[#E5F5EA] text-[#075B46] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-serif text-[#173C32]">Purchase Confirmed & Ownership Transferred!</h3>
                  <p className="text-xs text-[#6B7C74] mt-1">
                    Your circular order has been placed and inventory atomically verified.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7C74]">Order ID:</span>
                    <span className="font-mono font-bold text-[#075B46]">{confirmedOrder.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7C74]">Legal Owner:</span>
                    <span className="font-semibold text-[#173C32]">Owner 2 (Verified Buyer)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7C74]">Total Amount:</span>
                    <span className="font-bold text-[#173C32]">₹{confirmedOrder.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7C74]">Payment Status:</span>
                    <span className="font-semibold text-[#075B46]">{confirmedOrder.paymentStatus}</span>
                  </div>
                  {confirmedOrder.paymentTxRef && (
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Custody Tx Ref:</span>
                      <span className="font-mono text-[10px] text-[#075B46]">{confirmedOrder.paymentTxRef}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setCheckoutItem(null);
                      setSubTab("orders");
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-xs"
                  >
                    View in My Purchases
                  </button>
                  <button
                    onClick={() => setCheckoutItem(null)}
                    className="px-4 py-2.5 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74]"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
