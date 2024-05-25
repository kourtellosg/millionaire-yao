import { ethers } from "hardhat";

import type { MillionaireYao } from "../../types";
import { getSigners } from "../signers";

export async function deployMillionaireYaoFixture(): Promise<MillionaireYao> {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("MillionaireYao");
  const contract = await contractFactory.connect(signers.eve).deploy(signers.alice, signers.bob);
  await contract.waitForDeployment();

  return contract;
}
