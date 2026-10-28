import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting deployment of EWasteRegistry contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const EWasteRegistryFactory = await ethers.getContractFactory("EWasteRegistry");
  const registry = await EWasteRegistryFactory.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("EWasteRegistry deployed successfully to:", contractAddress);

  const deploymentData = {
    address: contractAddress,
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../artifacts/contracts/EWasteRegistry.sol/EWasteRegistry.json"),
        "utf8"
      )
    ).abi,
  };

  // Write deployment artifact locally
  const outPath = path.join(__dirname, "../deployed-contract.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentData, null, 2));
  console.log("Saved contract metadata to:", outPath);

  // Write deployment artifact to backend if folder exists
  const backendDir = path.join(__dirname, "../../backend/src/blockchain");
  if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(backendDir, "contract-config.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Exported contract metadata to backend:", path.join(backendDir, "contract-config.json"));
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
