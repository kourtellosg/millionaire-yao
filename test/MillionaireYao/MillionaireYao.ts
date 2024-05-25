import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { FhevmInstance } from "fhevmjs";
import { ethers } from "hardhat";

import { MillionaireYao } from "../../types";
import { asyncDecrypt, awaitAllDecryptionResults } from "../asyncDecrypt";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployMillionaireYaoFixture } from "./MillionaireYao.fixture";

const aliceWealth = 1000000;
const bobWealth = 2000000;

describe.only("MillionaireYao", function () {
  before(async function () {
    await asyncDecrypt();
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployMillionaireYaoFixture();
    this.contractAddress = await contract.getAddress();
    this.millionaireYao = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  async function sumbitWealth(
    contract: MillionaireYao,
    instance: FhevmInstance,
    signer: HardhatEthersSigner,
    amount: number,
  ) {
    const encryptedWealthAmount = instance.encrypt64(amount);
    const tx = await contract.connect(signer).submitWealth(encryptedWealthAmount);
    await tx.wait();
  }

  it("submitWealth() - should allow alice to submit their wealth", async function () {
    await sumbitWealth(this.millionaireYao, this.instances.alice, this.signers.alice, aliceWealth);

    const tokenAlice = this.instances.alice.getPublicKey(this.contractAddress)!;
    const encryptedAliceWealth = await this.millionaireYao
      .connect(this.signers.alice)
      .wealthOf(this.signers.alice, tokenAlice.publicKey, tokenAlice.signature);
    const aliceWealthDecrypted = this.instances.alice.decrypt(this.contractAddress, encryptedAliceWealth);
    expect(aliceWealthDecrypted).to.be.equal(aliceWealth);
  });

  it("submitWealth() - should allow bob to submit their wealth", async function () {
    await sumbitWealth(this.millionaireYao, this.instances.bob, this.signers.bob, bobWealth);
    const tokenBob = this.instances.bob.getPublicKey(this.contractAddress)!;
    const encryptedBobWealth = await this.millionaireYao
      .connect(this.signers.bob)
      .wealthOf(this.signers.bob, tokenBob.publicKey, tokenBob.signature);
    const bobWealthDecrypted = this.instances.bob.decrypt(this.contractAddress, encryptedBobWealth);
    expect(bobWealthDecrypted).to.be.equal(bobWealth);
  });

  it("submitWealth() - should revert if anyone other than alice or bob tries to submit their wealth", async function () {
    const encryptedWealthAmountAlice = this.instances.alice.encrypt64(aliceWealth);
    await expect(
      this.millionaireYao.connect(this.signers.eve).submitWealth(encryptedWealthAmountAlice),
    ).to.be.revertedWith("Only Alice or Bob can submit wealth");
  });

  it("submitWealth() - should revert if alice or bob try to resubmit their wealth", async function () {
    await sumbitWealth(this.millionaireYao, this.instances.alice, this.signers.alice, aliceWealth);
    const encryptedWealthAmountAlice = this.instances.alice.encrypt64(aliceWealth);
    await expect(
      this.millionaireYao.connect(this.signers.alice).submitWealth(encryptedWealthAmountAlice),
    ).to.be.revertedWith("Alice's wealth already submitted");

    await sumbitWealth(this.millionaireYao, this.instances.bob, this.signers.bob, bobWealth);
    const encryptedWealthAmountBob = this.instances.bob.encrypt64(bobWealth);
    await expect(
      this.millionaireYao.connect(this.signers.bob).submitWealth(encryptedWealthAmountBob),
    ).to.be.revertedWith("Bob's wealth already submitted");
  });
  it("wealthOf() - should revert if try to read someone else's wealth", async function () {
    const tokenAlice = this.instances.alice.getPublicKey(this.contractAddress)!;

    await expect(
      this.millionaireYao
        .connect(this.signers.alice)
        .wealthOf(this.signers.bob, tokenAlice.publicKey, tokenAlice.signature),
    ).to.be.revertedWith("User cannot reencrypt a non-owned wallet wealth");

    await expect(
      this.millionaireYao
        .connect(this.signers.eve)
        .wealthOf(this.signers.bob, tokenAlice.publicKey, tokenAlice.signature),
    ).to.be.revertedWith("EIP712 signer and transaction signer do not match");
  });

  it("check who is wealthier", async function () {
    await sumbitWealth(this.millionaireYao, this.instances.alice, this.signers.alice, aliceWealth);
    await sumbitWealth(this.millionaireYao, this.instances.bob, this.signers.bob, bobWealth);

    const tx = await this.millionaireYao.wealthCheck();
    await tx.wait();
    await awaitAllDecryptionResults();

    const isBobWealthier = await this.millionaireYao.isBobWealthier();
    const isAliceWealthier = await this.millionaireYao.isAliceWealthier();
    expect(isBobWealthier).to.be.equal(bobWealth > aliceWealth);
    expect(isAliceWealthier).to.be.equal(bobWealth <= aliceWealth);
  });
});
