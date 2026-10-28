// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EWasteRegistry
 * @dev Core smart contract for EcoTrace: E-Waste Lifecycle, Mass Balance Validation,
 * Recovery Yields, Duplicate Claim Prevention, and Product Provenance.
 */
contract EWasteRegistry {
    // Custom Errors
    error Unauthorized(address caller);
    error BatchAlreadyExists(string batchId);
    error BatchNotFound(string batchId);
    error InvalidStateTransition(string batchId, BatchStatus currentStatus);
    error MassBalanceMismatch(uint256 inputWeight, uint256 calculatedSum);
    error ClaimExceedsAvailableWeight(string materialBatchId, uint256 requested, uint256 available);
    error DuplicateClaimId(string claimId);
    error MaterialBatchNotFound(string materialBatchId);
    error ProductAlreadyExists(string productId);
    error ProductNotFound(string productId);
    error WeightMismatchFlagged(uint256 dispatchedWeight, uint256 receivedWeight);

    enum BatchStatus {
        Registered,
        Dispatched,
        Received,
        Processed,
        Disputed
    }

    struct WasteBatch {
        string batchId;
        string category;
        uint256 weightGrams;
        string evidenceHash;
        string destinationFacility;
        address registeredBy;
        uint256 timestamp;
        BatchStatus status;
        bool exists;
    }

    struct DispatchRecord {
        string dispatchId;
        string[] batchIds;
        address driver;
        string vehicleRegistration;
        uint256 dispatchedWeightGrams;
        uint256 receivedWeightGrams;
        string pickupProofHash;
        string deliveryProofHash;
        bool isDelivered;
        bool isDisputed;
        uint256 timestamp;
        bool exists;
    }

    struct ProcessingRecord {
        string processingId;
        string sourceBatchId;
        uint256 inputWeightGrams;
        uint256 totalRecoveredGrams;
        uint256 residualGrams;
        uint256 documentedLossGrams;
        string evidenceHash;
        address supervisor;
        uint256 timestamp;
        bool massBalanceValid;
        bool exists;
    }

    struct RecoveredMaterialBatch {
        string materialBatchId;
        string sourceBatchId;
        string materialType;
        uint256 recoveredWeightGrams;
        uint256 claimedWeightGrams;
        string evidenceHash;
        uint256 timestamp;
        bool exists;
    }

    struct RecoveryClaim {
        string claimId;
        string materialBatchId;
        uint256 claimedWeightGrams;
        string claimant;
        uint256 timestamp;
        bool exists;
    }

    struct RefurbishedProduct {
        string productId;
        string serialNumber;
        string sourceBatchId;
        string condition;
        string inspectionHash;
        uint256 refurbishmentTimestamp;
        bool exists;
    }

    // Storage
    address public admin;
    mapping(address => bool) public authorizedFacilities;
    mapping(address => bool) public authorizedTransporters;
    mapping(address => bool) public authorizedWorkers;

    mapping(string => WasteBatch) public batches;
    mapping(string => DispatchRecord) public dispatches;
    mapping(string => ProcessingRecord) public processings;
    mapping(string => RecoveredMaterialBatch) public recoveredMaterials;
    mapping(string => RecoveryClaim) public claims;
    mapping(string => RefurbishedProduct) public products;
    mapping(string => string) public serialToProductId;

    // Events
    event BatchRegistered(string indexed batchId, string category, uint256 weightGrams, address indexed registeredBy);
    event DispatchCreated(string indexed dispatchId, address indexed driver, uint256 dispatchedWeightGrams);
    event DispatchReceived(string indexed dispatchId, uint256 receivedWeightGrams, bool disputed);
    event ProcessingRecorded(string indexed processingId, string indexed sourceBatchId, uint256 inputWeightGrams, bool massBalanceValid);
    event MaterialRegistered(string indexed materialBatchId, string indexed sourceBatchId, string materialType, uint256 weightGrams);
    event RecoveryClaimApproved(string indexed claimId, string indexed materialBatchId, uint256 claimedWeightGrams, string claimant);
    event ProductRegistered(string indexed productId, string indexed serialNumber, string sourceBatchId);
    event DiscrepancyLogged(string indexed entityId, string reason, uint256 expectedWeight, uint256 actualWeight);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized(msg.sender);
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // Role Management
    function setFacilityAuthorization(address facility, bool authorized) external onlyAdmin {
        authorizedFacilities[facility] = authorized;
    }

    function setTransporterAuthorization(address transporter, bool authorized) external onlyAdmin {
        authorizedTransporters[transporter] = authorized;
    }

    function setWorkerAuthorization(address worker, bool authorized) external onlyAdmin {
        authorizedWorkers[worker] = authorized;
    }

    // 1. Batch Registration
    function registerBatch(
        string calldata batchId,
        string calldata category,
        uint256 weightGrams,
        string calldata evidenceHash,
        string calldata destinationFacility
    ) external {
        if (batches[batchId].exists) revert BatchAlreadyExists(batchId);

        batches[batchId] = WasteBatch({
            batchId: batchId,
            category: category,
            weightGrams: weightGrams,
            evidenceHash: evidenceHash,
            destinationFacility: destinationFacility,
            registeredBy: msg.sender,
            timestamp: block.timestamp,
            status: BatchStatus.Registered,
            exists: true
        });

        emit BatchRegistered(batchId, category, weightGrams, msg.sender);
    }

    // 2. Dispatch Creation
    function createDispatch(
        string calldata dispatchId,
        string[] calldata batchIds,
        address driver,
        string calldata vehicleRegistration,
        uint256 dispatchedWeightGrams,
        string calldata pickupProofHash
    ) external {
        if (dispatches[dispatchId].exists) revert BatchAlreadyExists(dispatchId);

        for (uint256 i = 0; i < batchIds.length; i++) {
            string memory bId = batchIds[i];
            if (!batches[bId].exists) revert BatchNotFound(bId);
            batches[bId].status = BatchStatus.Dispatched;
        }

        dispatches[dispatchId] = DispatchRecord({
            dispatchId: dispatchId,
            batchIds: batchIds,
            driver: driver,
            vehicleRegistration: vehicleRegistration,
            dispatchedWeightGrams: dispatchedWeightGrams,
            receivedWeightGrams: 0,
            pickupProofHash: pickupProofHash,
            deliveryProofHash: "",
            isDelivered: false,
            isDisputed: false,
            timestamp: block.timestamp,
            exists: true
        });

        emit DispatchCreated(dispatchId, driver, dispatchedWeightGrams);
    }

    // 3. Receiving Confirmation & Discrepancy Flagging
    function recordReceiving(
        string calldata dispatchId,
        uint256 receivedWeightGrams,
        string calldata deliveryProofHash,
        bool disputeWeight
    ) external {
        if (!dispatches[dispatchId].exists) revert BatchNotFound(dispatchId);

        DispatchRecord storage dispatch = dispatches[dispatchId];
        dispatch.receivedWeightGrams = receivedWeightGrams;
        dispatch.deliveryProofHash = deliveryProofHash;
        dispatch.isDelivered = true;
        dispatch.isDisputed = disputeWeight || (dispatch.dispatchedWeightGrams != receivedWeightGrams);

        BatchStatus newStatus = dispatch.isDisputed ? BatchStatus.Disputed : BatchStatus.Received;

        for (uint256 i = 0; i < dispatch.batchIds.length; i++) {
            batches[dispatch.batchIds[i]].status = newStatus;
        }

        if (dispatch.isDisputed) {
            emit DiscrepancyLogged(
                dispatchId,
                "Received weight differs from dispatched weight",
                dispatch.dispatchedWeightGrams,
                receivedWeightGrams
            );
        }

        emit DispatchReceived(dispatchId, receivedWeightGrams, dispatch.isDisputed);
    }

    // 4. Recycling & Mass Balance Validation
    function recordProcessing(
        string calldata processingId,
        string calldata sourceBatchId,
        uint256 inputWeightGrams,
        uint256 totalRecoveredGrams,
        uint256 residualGrams,
        uint256 documentedLossGrams,
        string calldata evidenceHash
    ) external {
        if (processings[processingId].exists) revert BatchAlreadyExists(processingId);
        if (!batches[sourceBatchId].exists) revert BatchNotFound(sourceBatchId);

        // Exact Mass Balance equation: Input = Output + Residual + DocumentedLoss
        uint256 totalAccounted = totalRecoveredGrams + residualGrams + documentedLossGrams;
        if (totalAccounted != inputWeightGrams) {
            revert MassBalanceMismatch(inputWeightGrams, totalAccounted);
        }

        processings[processingId] = ProcessingRecord({
            processingId: processingId,
            sourceBatchId: sourceBatchId,
            inputWeightGrams: inputWeightGrams,
            totalRecoveredGrams: totalRecoveredGrams,
            residualGrams: residualGrams,
            documentedLossGrams: documentedLossGrams,
            evidenceHash: evidenceHash,
            supervisor: msg.sender,
            timestamp: block.timestamp,
            massBalanceValid: true,
            exists: true
        });

        batches[sourceBatchId].status = BatchStatus.Processed;

        emit ProcessingRecorded(processingId, sourceBatchId, inputWeightGrams, true);
    }

    // 5. Recovered Material Registration
    function registerRecoveredMaterial(
        string calldata materialBatchId,
        string calldata sourceBatchId,
        string calldata materialType,
        uint256 recoveredWeightGrams,
        string calldata evidenceHash
    ) external {
        if (recoveredMaterials[materialBatchId].exists) revert BatchAlreadyExists(materialBatchId);

        recoveredMaterials[materialBatchId] = RecoveredMaterialBatch({
            materialBatchId: materialBatchId,
            sourceBatchId: sourceBatchId,
            materialType: materialType,
            recoveredWeightGrams: recoveredWeightGrams,
            claimedWeightGrams: 0,
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            exists: true
        });

        emit MaterialRegistered(materialBatchId, sourceBatchId, materialType, recoveredWeightGrams);
    }

    // 6. Duplicate-Claim Prevention System
    function claimRecoveredMaterial(
        string calldata claimId,
        string calldata materialBatchId,
        uint256 claimWeightGrams,
        string calldata claimant
    ) external {
        if (claims[claimId].exists) revert DuplicateClaimId(claimId);
        if (!recoveredMaterials[materialBatchId].exists) revert MaterialBatchNotFound(materialBatchId);

        RecoveredMaterialBatch storage mat = recoveredMaterials[materialBatchId];
        uint256 remainingClaimable = mat.recoveredWeightGrams - mat.claimedWeightGrams;

        if (claimWeightGrams > remainingClaimable) {
            revert ClaimExceedsAvailableWeight(materialBatchId, claimWeightGrams, remainingClaimable);
        }

        mat.claimedWeightGrams += claimWeightGrams;

        claims[claimId] = RecoveryClaim({
            claimId: claimId,
            materialBatchId: materialBatchId,
            claimedWeightGrams: claimWeightGrams,
            claimant: claimant,
            timestamp: block.timestamp,
            exists: true
        });

        emit RecoveryClaimApproved(claimId, materialBatchId, claimWeightGrams, claimant);
    }

    // 7. Refurbished Product Registration & Provenance
    function registerRefurbishedProduct(
        string calldata productId,
        string calldata serialNumber,
        string calldata sourceBatchId,
        string calldata condition,
        string calldata inspectionHash
    ) external {
        if (products[productId].exists) revert ProductAlreadyExists(productId);

        products[productId] = RefurbishedProduct({
            productId: productId,
            serialNumber: serialNumber,
            sourceBatchId: sourceBatchId,
            condition: condition,
            inspectionHash: inspectionHash,
            refurbishmentTimestamp: block.timestamp,
            exists: true
        });

        if (bytes(serialNumber).length > 0) {
            serialToProductId[serialNumber] = productId;
        }

        emit ProductRegistered(productId, serialNumber, sourceBatchId);
    }

    // 8. Public Verification Views
    function getBatch(string calldata batchId) external view returns (WasteBatch memory) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);
        return batches[batchId];
    }

    function getDispatch(string calldata dispatchId) external view returns (DispatchRecord memory) {
        if (!dispatches[dispatchId].exists) revert BatchNotFound(dispatchId);
        return dispatches[dispatchId];
    }

    function getProcessing(string calldata processingId) external view returns (ProcessingRecord memory) {
        if (!processings[processingId].exists) revert BatchNotFound(processingId);
        return processings[processingId];
    }

    function getMaterialBatch(string calldata materialBatchId) external view returns (RecoveredMaterialBatch memory) {
        if (!recoveredMaterials[materialBatchId].exists) revert MaterialBatchNotFound(materialBatchId);
        return recoveredMaterials[materialBatchId];
    }

    function verifyProduct(string calldata productId) external view returns (RefurbishedProduct memory) {
        if (!products[productId].exists) revert ProductNotFound(productId);
        return products[productId];
    }

    function verifyBySerial(string calldata serialNumber) external view returns (RefurbishedProduct memory) {
        string memory productId = serialToProductId[serialNumber];
        if (bytes(productId).length == 0 || !products[productId].exists) {
            revert ProductNotFound(serialNumber);
        }
        return products[productId];
    }
}
