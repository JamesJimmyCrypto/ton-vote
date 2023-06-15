import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKeys, releaseMode, TX_FEES } from "config";
import _ from "lodash";
import {
  daoSetOwner,
  daoSetProposalOwner,
  getClientV2,
  newDao,
  newMetdata,
  newProposal,
  newRegistry,
  ProposalMetadata,
  proposalSendMessage,
  ReleaseMode,
  setDeployAndInitDaoFee,
  setFwdMsgFee,
  setMetadata,
  setRegistryAdmin,
  updateProposal,
} from "ton-vote-contracts-sdk";
import {
  useAppParams,
  useGetProposalStatusCallback,
  useGetSender,
  useRole,
} from "hooks/hooks";
import { showSuccessToast, useErrorToast } from "toasts";
import {
  useDaoQuery,
  useDaosQuery,
  useDaoStateQuery,
  useGetClients,
  useProposalQuery,
  useRegistryStateQuery,
} from "./getters";
import { useSyncStore, useVotePersistedStore, useVoteStore } from "store";
import {
  delay,
  getTxFee,
  getVoteStrategyType,
  Logger,
  parseVotes,
  validateAddress,
} from "utils";
import { CreateDaoArgs, CreateMetadataArgs, UpdateMetadataArgs } from "./types";
import { useTonAddress } from "@tonconnect/ui-react";
import { analytics } from "analytics";
import { Proposal, ProposalStatus } from "types";
import { useAppNavigation } from "router/navigation";
import { contract } from "contract";
import { lib } from "lib";
import retry from "async-retry";

export const useCreateNewRegistry = () => {
  const getSender = useGetSender();
  const address = useTonAddress();
  const showErrorToast = useErrorToast();
  const registryState = useRegistryStateQuery().data;

  return useMutation(
    async (releaseMode: number) => {
      if (!Object.keys(ReleaseMode).includes(releaseMode.toString())) {
        throw new Error("Invalid release mode");
      }
      if (!registryState?.admin || address !== registryState.admin) {
        throw new Error("You are not the registry admin");
      }
      const clientV2 = await getClientV2();
      const sender = getSender();
      return newRegistry(
        sender,
        clientV2,
        releaseMode,
        TX_FEES.BASE.toString(),
        address!
      );
    },
    {
      onError: (error) => showErrorToast(error),
    }
  );
};

export const useSetCreateDaoFee = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();
  const address = useTonAddress();
  const registryState = useRegistryStateQuery().data;
  const refetch = useDaoStateQuery().refetch;

  return useMutation(
    async ({ value }: { value: number; onError: (value: string) => void }) => {
      if (address !== registryState?.admin) {
        throw new Error("You are not the registry admin");
      }
      if (!_.isNumber(value) || value < 0) {
        throw new Error("Fee must be zero or positive");
      }
      const client = await getClientV2();
      return setDeployAndInitDaoFee(
        getSender(),
        client,
        releaseMode,
        TX_FEES.BASE.toString(),
        value.toString()
      );
    },
    {
      onSuccess: () => refetch(),
      onError: (error: Error, args) => {
        args.onError(error.message);
        errorToast(error);
      },
    }
  );
};

export const useSetDaoFwdMsgFee = () => {
  const registryState = useRegistryStateQuery().data;
  const address = useTonAddress();
  const errorToast = useErrorToast();

  const getSender = useGetSender();
  return useMutation(
    async ({
      daoIds,
      amount,
    }: {
      daoIds: number[];
      amount?: number;
      onError: (error: string) => void;
      onSuccess?: () => void;
    }) => {
      if (registryState?.admin !== address) {
        throw new Error("You are not the registry admin");
      }

      if (!_.isNumber(amount)) {
        throw new Error("Forward Message Fee is required");
      }
      if (amount < 0) {
        throw new Error("Forward Message Fee must be at least 0");
      }
      const client = await getClientV2();
      return setFwdMsgFee(
        getSender(),
        client,
        releaseMode,
        TX_FEES.BASE.toString(),
        daoIds.map((it) => it.toString()),
        amount.toString()
      );
    },
    {
      onError: (error: Error, args) => {
        args.onError(error.message);
        errorToast(error);
      },
      onSuccess: (_, args) => args.onSuccess?.(),
    }
  );
};

export const useSetRegistryAdmin = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();

  const { refetch, data: registryState } = useRegistryStateQuery();
  const address = useTonAddress();

  return useMutation(
    async ({
      newRegistryAdmin,
    }: {
      newRegistryAdmin?: string;
      onError: (newRegistryAdmin: string) => void;
    }) => {
      if (address !== registryState?.admin) {
        throw new Error("You are not the registry admin");
      }
      if (!newRegistryAdmin) {
        throw new Error("Registry admin is required");
      }
      if (!validateAddress(newRegistryAdmin)) {
        throw new Error("Invalid register admin address");
      }
      const client = await getClientV2();

      return setRegistryAdmin(
        getSender(),
        client,
        releaseMode,
        TX_FEES.BASE.toString(),
        newRegistryAdmin
      );
    },
    {
      onSuccess: (_, args) => {
        refetch();
      },
      onError: (error: Error, args) => {
        args.onError(error.message);
        errorToast(error);
      },
    }
  );
};

export const useCreateDaoQuery = () => {
  const getSender = useGetSender();
  const registryState = useRegistryStateQuery().data;
  const showErrorToast = useErrorToast();

  return useMutation(
    async (args: CreateDaoArgs) => {
      const sender = getSender();
      const clientV2 = await getClientV2();

      const address = await newDao(
        sender,
        clientV2,
        releaseMode,
        getTxFee(
          Number(registryState?.deployAndInitDaoFee),
          TX_FEES.CREATE_DAO
        ),
        args.metadataAddress,
        args.ownerAddress,
        args.proposalOwner
      );

      if (typeof address !== "string") {
        throw new Error("Failed to create Dao");
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        showErrorToast(error);
        analytics.createSpaceFailed(args.metadataAddress, error.message);
      },
      onSuccess: (address, args) => {
        args.onSuccess(address);
        analytics.createSpaceSuccess(args.metadataAddress, address);
        showSuccessToast(`Space created successfully`);
      },
    }
  );
};

export const useCreateMetadataQuery = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();

  return useMutation(
    async (args: CreateMetadataArgs) => {
      const { metadata } = args;
      const sender = getSender();

      const clientV2 = await getClientV2();
      // const isMetadataExist = await metdataExists(clientV2, metadata);

      const address = await newMetdata(
        sender,
        clientV2,
        TX_FEES.CREATE_METADATA.toString(),
        metadata
      );

      if (typeof address !== "string") {
        throw new Error("Failed to create Space metadata");
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        errorToast(error);
        analytics.createSpaceMetadataFailed(error.message, args.metadata);
      },
      onSuccess: (address, args) => {
        analytics.createSpaceMetadataSucess(address, args.metadata);
        args.onSuccess(address);
      },
    }
  );
};

interface CreateProposalArgs {
  metadata: Partial<ProposalMetadata>;
  onSuccess: (value: string) => void;
}

export const useCreateProposalQuery = () => {
  const { daoAddress } = useAppParams();

  const dao = useDaoQuery(daoAddress).data;
  const getSender = useGetSender();
  const daoState = useDaoStateQuery(dao?.daoAddress).data;
  const { isOwner, isProposalPublisher } = useRole(dao?.daoRoles);
  const showErrorToast = useErrorToast();

  return useMutation(
    async (args: CreateProposalArgs) => {
      const allowed = isOwner || isProposalPublisher;

      const { metadata } = args;
      const sender = getSender();
      if (!allowed) {
        throw new Error("You are not allowed to create a proposal");
      }
      const address = await newProposal(
        sender,
        await getClientV2(),
        getTxFee(Number(daoState?.fwdMsgFee), TX_FEES.FORWARD_MSG),
        dao?.daoAddress!,
        metadata as ProposalMetadata
      );

      if (typeof address !== "string") {
        throw new Error("Failed to create Proposal");
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        showErrorToast(error);
        analytics.createProposalFailed(
          args.metadata as ProposalMetadata,
          error.message
        );
      },
      onSuccess: (address, args) => {
        analytics.createProposalSuccess(
          args.metadata as ProposalMetadata,
          address
        );
        showSuccessToast("Proposal created successfully");
        args.onSuccess(address);
      },
    }
  );
};

export const useSetDaoOwnerQuery = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();
  const { setDaoUpdateMillis } = useSyncStore();
  const { daoAddress } = useAppParams();

  const refetch = useDaoQuery(daoAddress).refetch;

  return useMutation(
    async ({
      newOwner,
    }: {
      newOwner?: string;
      onError: (value: string) => void;
    }) => {
      if (!newOwner) {
        throw new Error("Owner address is required");
      }
      if (!validateAddress(newOwner)) {
        throw new Error("Invalid owner address");
      }
      const clientV2 = await getClientV2();
      await daoSetOwner(
        getSender(),
        clientV2,
        daoAddress,
        TX_FEES.BASE.toString(),
        newOwner
      );
      setDaoUpdateMillis(daoAddress);
      return refetch();
    },
    {
      onError: (error, args) => {
        errorToast(error);
        args.onError("Failed to set new owner");
      },
    }
  );
};

export const useSetDaoPublisherQuery = () => {
  const getSender = useGetSender();
  const { setDaoUpdateMillis } = useSyncStore();
  const { daoAddress } = useAppParams();
  const { refetch: refetchDao } = useDaoQuery(daoAddress);

  const errorToast = useErrorToast();

  return useMutation(
    async ({
      newOwner,
    }: {
      newOwner?: string;
      onError: (value: string) => void;
    }) => {
      if (!newOwner) {
        throw new Error("Proposal owner address is required");
      }
      if (!validateAddress(newOwner)) {
        throw new Error("Invalid proposal owner address");
      }

      const clientV2 = await getClientV2();
      await daoSetProposalOwner(
        getSender(),
        clientV2,
        TX_FEES.BASE.toString(),
        daoAddress,
        newOwner
      );
      setDaoUpdateMillis(daoAddress);
      return refetchDao();
    },
    {
      onError: (error: Error, args) => {
        args.onError(error.message);
        errorToast(error);
      },
    }
  );
};

export const useUpdateDaoMetadataQuery = () => {
  const getSender = useGetSender();
  const { setDaoUpdateMillis } = useSyncStore();
  const refetchDaos = useDaosQuery().refetch;
  const { daoAddress } = useAppParams();

  const refetchUpdatedDao = useDaoQuery(daoAddress).refetch;

  const errorToast = useErrorToast();

  return useMutation(
    async (args: UpdateMetadataArgs) => {
      const { metadata, daoAddress } = args;

      const sender = getSender();
      const clientV2 = await getClientV2();

      const metadataAddress = await newMetdata(
        sender,
        clientV2,
        TX_FEES.CREATE_METADATA.toString(),
        metadata
      );

      if (typeof metadataAddress !== "string") {
        throw new Error("Failed to update metadata");
      }

      const address = await setMetadata(
        sender,
        clientV2,
        TX_FEES.SET_METADATA.toString(),
        daoAddress,
        metadataAddress
      );

      if (typeof address !== "string") {
        throw new Error("Failed to update metadata");
      }
      return address;
    },
    {
      onError: (error: Error, args) => {
        errorToast(error);
        analytics.updateDaoMetatdaFailed(
          args.metadata,
          args.daoAddress,
          error.message
        );
      },
      onSuccess: (_, args) => {
        showSuccessToast("Metadata updated");
        setDaoUpdateMillis(args.daoAddress);
        refetchDaos();
        refetchUpdatedDao();
        analytics.updateDaoMetadataSuccess(args.metadata, args.daoAddress);
      },
    }
  );
};

export const useVote = () => {
  const getSender = useGetSender();
  const { proposalAddress } = useAppParams();
  const store = useVotePersistedStore();
  const { data: proposal } = useProposalQuery(proposalAddress);
  const queryClient = useQueryClient();
  const successCallback = useVoteSuccessCallback(proposalAddress);

  const errorToast = useErrorToast();
  const { setIsVoting } = useVoteStore();

  return useMutation(
    async (vote: string) => {
      if (!proposal) {
        throw new Error("Proposal not found");
      }
      setIsVoting(true);
      const sender = getSender();
      const client = await getClientV2();

      await proposalSendMessage(
        sender,
        client,
        TX_FEES.VOTE_FEE.toString(),
        proposalAddress,
        vote
      );
      await delay(1000)
      return successCallback(proposal);
    },
    {
      onSuccess: (values, _vote) => {
        analytics.voteSuccess(proposalAddress, _vote);

        if (!values) return;

        const { proposalResults, vote, maxLt } = values;

        queryClient.setQueryData(
          [QueryKeys.PROPOSAL, proposalAddress],
          (prev?: any) => {
            return {
              ...prev,
              proposalResult: proposalResults,
              votes: vote ? [vote, ...prev?.votes] : prev?.votes,
            };
          }
        );

        Logger(
          `vote success manually updating proposal query, and setting local storage`
        );
        Logger(maxLt, "maxLt");
        Logger(vote, "walletVote");
        Logger(proposalResults, "results");
        // we save this data in local storage, and display it untill the server is up to date
        store.setValues(proposalAddress, maxLt, vote, proposalResults);
        showSuccessToast(`Voted ${_vote} successfully`);
      },
      onSettled: () => {
        setIsVoting(false);
      },
      onError: (error: Error, vote) => {
        errorToast(error);
        analytics.voteError(proposalAddress, vote, error.message);
      },
    }
  );
};

export const useUpdateProposalMutation = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();
  const { setProposalUpdateMillis } = useSyncStore();
  const { proposalAddress, daoAddress } = useAppParams();

  const getProposalStatus = useGetProposalStatusCallback();

  const { refetch } = useProposalQuery(proposalAddress);
  const { proposalPage } = useAppNavigation();

  return useMutation(
    async (metadata: ProposalMetadata) => {
      const proposalQuery = await refetch();
      const { proposalStatus } = getProposalStatus(
        proposalQuery.data?.metadata!
      );

      if (proposalStatus !== ProposalStatus.NOT_STARTED) {
        throw new Error(
          "Proposal is already started, you cant edit it anymore"
        );
      }

      const sender = getSender();
      const client = await getClientV2();

      await updateProposal(
        sender,
        client,
        TX_FEES.FORWARD_MSG.toString(),
        daoAddress,
        proposalAddress,
        metadata
      );
    },
    {
      onSuccess: () => {
        showSuccessToast("Proposal updated");
        setProposalUpdateMillis(proposalAddress);
        proposalPage.root(daoAddress, proposalAddress);
      },
      onError: (error: Error) => {
        errorToast(error);
      },
    }
  );
};

export const useVoteSuccessCallback = (proposalAddress: string) => {
  const walletAddress = useTonAddress();

  return async (proposal: Proposal) => {
    const promise = async (bail: any, attempt: number) => {
      Logger(`getting proposal results after vote, attempt ${attempt} `);
      if (!proposal.metadata || !walletAddress) return;

      const nftItemsHolders = await lib.getAllNFTHolders(
        proposalAddress,
        proposal.metadata
      );
      return contract.getProposalResultsAfterVote({
        proposalAddress,
        walletAddress,
        proposal,
        nftItemsHolders,
      });
    };

    return retry(promise, { retries: 2 });
  };
};
