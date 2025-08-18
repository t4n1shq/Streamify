import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";

export async function getRecommendedUsers(req, res) {
    try {
        const currentUserID = req.user._id;
        const currentUser = req.user;
        const recommendedUsers = await User.find({
            $and: [
                {_id: {$ne: currentUserID}},
                {$id: {$ne: currentUser.friends}},
                {isOnboarded: true},
            ]
        });

        res.status(200).json(recommendedUsers);
    } catch (error) {
        console.error("Error in getRecommendedUsers controller", error.message);
        res.status(500).json({message: "Internal Server Error"})
    }
}

export async function getMyFriends(req, res) {
    try {
        const user = await User.find(req.user._id).select("friends")
        .populate("friends", "fullName profilePic");

        res.status(200).json(user.friends);
    } catch (error) {
        console.error("Error in getMyFriends controller", error.message);
        res.status(500).json({message: "Internal Server Error"})
    }
}

export async function sendFriendRequest(req, res) {
    try {
        const myId = req.user.id;
        const {id: recipientId} = req.params;

        if (myId === recipientId) {
            return res.status(400).json({message: "Cannot send friend request to yourself"});
        }

        const recipient = await User.fidByID(recipientId);
        if (!recipient) {
            return res.status(404).json({message: "User not found"});
        }

        if (recipient.friends.includes(myId)) {
            return res.status(400).json({message: "You are already friends with this user"});
        }

        const existingRequest = await FriendRequest.findOne({
            $or: [
                {sender: myId, recipient: recipientId},
                {recipient: myId, sender: recipientId},
            ]
        })

        if (existingRequest) {
            return res.status(400).json({message: "A friend request already exists between you and this User"});
        }

        const friendRequest = await FriendRequest.create({
            sender: myId,
            recipient: recipientId,
        })

        res.status(201).json(friendRequest);
    } catch (error) {
        console.error("Error in sendFriendRequest controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export async function acceptFriendRequest(req, res) {
    try {
        const {id: requestId} = req.params
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({message: "Friend request not found"});
        }

        if (friendRequest.recipient.toString() !== req.user.id) {
            res.status(403).json({message: "You are not authorized to accept this request"});
        }

        friendRequest.status = "accepted";
        await friendRequest.save();

        // add each user to each other's friend array
        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: {friends: friendRequest.recipient}
        });
        await User.findByIdAndUpdate(friendRequest.recipient, {
            $addToSet: {friends: friendRequest.sender}
        });

    } catch (error) {
        console.error("Error in acceptFriendRequest controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export async function getFriendRequests(req, res) {
    try {
        const currentUser = req.user.id;

        const incomingRequests = await FriendRequest.find({
            recipient: currentUser,
            status: "pending",
        }).populate("sender", "fullName profilePic");

        const acceptedRequests = await FriendRequest.find({
            recipient: currentUser,
            status: "accepted",
        }).populate("sender", "fullName profilePic");

        res.status(200).json({incomingRequests, acceptRequests});
    } catch (error) {
        console.error("Error in getFriendRequests controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export async function getOutgoingFriendRequests(req, res) {
    try {
        const currentUser = req.user.id;
        const outgoingRequests = await FriendRequest.find({
            sender: currentUser,
            status: "pending",
        }).populate("recipient", "fullName profilePic");
    } catch (error) {
        console.error("Error in getOutgoingFriendRequests controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
}